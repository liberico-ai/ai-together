"""Pre-install and pre-upgrade operational preflight for LibeTech AI OS (V1).

Runs strictly with the Python standard library so `install-d1.sh` and operators
can execute it under `python3 -I` (isolated mode). Never prints secrets,
database URLs, passwords, keys, tokens, or raw database error details.

Checks:
  (a) Duplicate Hermes plugin names across all scanned plugin directories and
      which copy wins under the loader precedence model (default: last-wins).
  (b) Bundle integrity and `release.env` match (treeSha256 digest + version,
      plus optional plugin version and archive SHA-256).
  (c) Migration ledger integrity (bundle files, rollback files for >= 013, and
      read-only PostgreSQL `public.schema_migrations` verification).
  (d) Systemd unit execution user and scope (`/etc/systemd/system` + drop-ins
      vs `systemd --user` + drop-ins; blocks root system units and split scope).
  (e) Backup directory strictly outside every Hermes plugin scan path, and no
      backup artifacts sitting inside any scan directory.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
from urllib.parse import parse_qs, unquote, urlsplit

DEFAULT_HERMES_ROOT = Path("/home/iptech/.hermes")
DEFAULT_SYSTEM_UNIT_DIR = Path("/etc/systemd/system")
DEFAULT_USER_UNIT_DIR = Path("/home/iptech/.config/systemd/user")
DEFAULT_USER_UNIT_OWNER = "iptech"
DEFAULT_USER_PSQL = Path("/home/iptech/.local/share/libetech-ai-os/pgroot/usr/lib/postgresql/16/bin/psql")
DEFAULT_USER_PGLIB = Path("/home/iptech/.local/share/libetech-ai-os/pgroot/usr/lib/x86_64-linux-gnu")

HEX64_RE = re.compile(r"^[0-9a-f]{64}$")
HEX40_RE = re.compile(r"^[0-9a-f]{40}$")
ENV_KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
MIGRATION_FILE_RE = re.compile(r"^(\d+).*\.sql$")
PLUGIN_INIT_VERSION_RE = re.compile(r"""^VERSION\s*=\s*(['"])([^'"]+)\1\s*(?:#.*)?$""")
BACKUP_ARTIFACT_RE = re.compile(
    r"(?:^|[._-])(?:bak|backup|backups|old|orig|prev|disabled|rollback)(?:$|[._-].*)|~$|\.(?:tar|tar\.gz|tgz|zip)$",
    re.IGNORECASE,
)

# Strict non-secret allowlist for release.env. Unlisted keys (e.g., DATABASE_URL,
# tokens, passwords) are ignored and never stored or echoed.
RELEASE_ENV_ALLOWLIST = frozenset({
    "LIBETECH_BUILD_DIGEST",
    "LIBETECH_BUNDLE_TREE_SHA256",
    "LIBETECH_RELEASE_VERSION",
    "RELEASE_VERSION",
    "LIBETECH_PLUGIN_VERSION",
    "LIBETECH_ARCHIVE_SHA256",
    "SOURCE_SHA",
})

MAX_PLUGIN_SCAN_DEPTH = 8


def add_error(errors: list[dict], code: str, check: str, message: str) -> None:
    errors.append({"code": code, "check": check, "message": message})


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_simple_yaml_scalars(text: str) -> tuple[dict[str, str], list[str]]:
    """Parse top-level (0-indent) key: scalar pairs from plugin.yaml without PyYAML."""
    values: dict[str, str] = {}
    problems: list[str] = []
    if text.startswith("\ufeff"):
        text = text[1:]
    for lineno, raw in enumerate(text.splitlines(), 1):
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if raw[0] in (" ", "\t", "-"):
            # Nested mapping or sequence item (e.g., provides_tools list)
            continue
        if ":" not in raw:
            problems.append(f"line {lineno}: missing ':'")
            continue
        key, rest = raw.split(":", 1)
        key = key.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]*", key):
            problems.append(f"line {lineno}: invalid key")
            continue
        val = rest.strip()
        if not val:
            # Block value starts on subsequent indented lines (e.g., provides_tools:)
            continue
        parsed = _unquote_yaml_scalar(val)
        if parsed is None:
            problems.append(f"line {lineno}: unterminated quote")
            continue
        if key in values:
            problems.append(f"line {lineno}: duplicate top-level key '{key}'")
            continue
        values[key] = parsed
    return values, problems


def _unquote_yaml_scalar(val: str) -> str | None:
    if val[0] == '"':
        out: list[str] = []
        i = 1
        escaped = False
        while i < len(val):
            ch = val[i]
            if escaped:
                out.append(ch)
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                trailing = val[i + 1 :].strip()
                if trailing and not trailing.startswith("#"):
                    return None
                return "".join(out)
            else:
                out.append(ch)
            i += 1
        return None
    if val[0] == "'":
        out = []
        i = 1
        while i < len(val):
            ch = val[i]
            if ch == "'":
                if i + 1 < len(val) and val[i + 1] == "'":
                    out.append("'")
                    i += 2
                    continue
                trailing = val[i + 1 :].strip()
                if trailing and not trailing.startswith("#"):
                    return None
                return "".join(out)
            out.append(ch)
            i += 1
        return None
    # Unquoted scalar: strip inline comment preceded by whitespace.
    m = re.search(r"\s+#", val)
    if m:
        val = val[: m.start()].rstrip()
    return val


def read_init_version(init_path: Path) -> str | None:
    if not init_path.is_file():
        return None
    try:
        text = init_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None
    for line in text.splitlines():
        m = PLUGIN_INIT_VERSION_RE.match(line.strip())
        if m:
            return m.group(2)
    return None


def parse_release_env(path: Path) -> tuple[dict[str, str], list[str]]:
    """Read only allowlisted non-secret keys from release.env; never quote raw lines."""
    values: dict[str, str] = {}
    problems: list[str] = []
    text = path.read_text(encoding="utf-8", errors="replace")
    if text.startswith("\ufeff"):
        text = text[1:]
    for lineno, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export ") and len(line) > 7 and line[7].strip():
            line = line[7:].lstrip()
        if "=" not in line:
            problems.append(f"line {lineno}: malformed entry (missing '=')")
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        if not ENV_KEY_RE.fullmatch(key):
            problems.append(f"line {lineno}: invalid variable name")
            continue
        if key not in RELEASE_ENV_ALLOWLIST:
            # Never store or echo non-allowlisted values (secrets may exist if wrong file passed).
            continue
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in ('"', "'"):
            val = val[1:-1]
        if key in values and values[key] != val:
            problems.append(f"line {lineno}: conflicting duplicate key '{key}'")
            continue
        values[key] = val
    return values, problems


def check_bundle_and_release(
    bundle: Path,
    *,
    mode: str,
    release_env_path: Path | None,
    expected_digest: str | None,
    expected_version: str | None,
    archive_path: Path | None,
    verify_files: bool,
    errors: list[dict],
) -> dict:
    """Check (b): bundle integrity + release.env digest/version alignment."""
    info: dict = {
        "bundle_path": str(bundle),
        "package_version": None,
        "manifest_version": None,
        "tree_sha256": None,
        "bundle_plugin_name": None,
        "bundle_plugin_version": None,
        "bundle_plugin_init_version": None,
        "manifest_files_checked": False,
        "release_env_path": str(release_env_path) if release_env_path else None,
        "release_env_status": "not-checked",
    }

    if not bundle.is_dir() or bundle.is_symlink():
        add_error(errors, "PREFLIGHT-BUNDLE-INVALID", "release", "Bundle path is missing or is a symlink.")
        return info
    bundle_real = Path(os.path.realpath(bundle))

    pkg_path = bundle_real / "package.json"
    manifest_path = bundle_real / "deploy/BUNDLE-MANIFEST.json"
    if not pkg_path.is_file() or pkg_path.is_symlink():
        add_error(errors, "PREFLIGHT-BUNDLE-INVALID", "release", "Bundle is missing regular package.json.")
        return info
    if not manifest_path.is_file() or manifest_path.is_symlink():
        add_error(errors, "PREFLIGHT-BUNDLE-INVALID", "release", "Bundle is missing regular deploy/BUNDLE-MANIFEST.json.")
        return info

    try:
        pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        add_error(errors, "PREFLIGHT-BUNDLE-INVALID", "release", "Bundle package.json or BUNDLE-MANIFEST.json is unreadable JSON.")
        return info

    pkg_ver = pkg.get("version") if isinstance(pkg, dict) else None
    man_ver = manifest.get("version") if isinstance(manifest, dict) else None
    files = manifest.get("files") if isinstance(manifest, dict) else None
    declared_tree = manifest.get("treeSha256") if isinstance(manifest, dict) else None

    info["package_version"] = pkg_ver
    info["manifest_version"] = man_ver

    if not isinstance(pkg_ver, str) or not pkg_ver.strip():
        add_error(errors, "PREFLIGHT-BUNDLE-INVALID", "release", "package.json version is missing.")
        return info
    if not isinstance(files, dict) or not files or not isinstance(declared_tree, str) or not HEX64_RE.fullmatch(declared_tree):
        add_error(errors, "PREFLIGHT-BUNDLE-INVALID", "release", "BUNDLE-MANIFEST.json has invalid files map or treeSha256.")
        return info

    computed_tree = hashlib.sha256(
        json.dumps(files, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    info["tree_sha256"] = computed_tree
    if not hmac.compare_digest(computed_tree, declared_tree):
        add_error(errors, "PREFLIGHT-BUNDLE-INVALID", "release", "BUNDLE-MANIFEST.json treeSha256 does not match its files map.")

    if not isinstance(man_ver, str) or man_ver != pkg_ver:
        add_error(
            errors,
            "PREFLIGHT-BUNDLE-VERSION-MISMATCH",
            "release",
            f"BUNDLE-MANIFEST.json version ({man_ver!r}) does not match package.json version ({pkg_ver!r}).",
        )

    if verify_files:
        for rel, expected_hash in files.items():
            if not isinstance(rel, str) or not isinstance(expected_hash, str) or not HEX64_RE.fullmatch(expected_hash):
                add_error(errors, "PREFLIGHT-BUNDLE-INVALID", "release", "Invalid entry in BUNDLE-MANIFEST.json.")
                break
            target = bundle_real / rel
            if target.is_symlink() or not Path(os.path.realpath(target)).is_relative_to(bundle_real) or not target.is_file():
                add_error(errors, "PREFLIGHT-BUNDLE-INVALID", "release", f"Invalid or missing bundle file: {rel}")
                break
            if not hmac.compare_digest(sha256_file(target), expected_hash):
                add_error(errors, "PREFLIGHT-BUNDLE-INVALID", "release", f"Bundle content hash mismatch: {rel}")
                break
        else:
            # Also reject unlisted files, symlinks, and bytecode caches in the bundle.
            present: set[str] = set()
            unlisted_problem = False
            for dirpath, dirnames, filenames in os.walk(bundle_real):
                for d in dirnames:
                    p = Path(dirpath) / d
                    if p.is_symlink() or d == "__pycache__":
                        add_error(errors, "PREFLIGHT-BUNDLE-INVALID", "release", f"Forbidden symlinked directory or bytecode cache in bundle: {p.relative_to(bundle_real)}")
                        unlisted_problem = True
                        break
                if unlisted_problem:
                    break
                for n in filenames:
                    p = Path(dirpath) / n
                    if p.is_symlink() or n.endswith((".pyc", ".pyo")):
                        add_error(errors, "PREFLIGHT-BUNDLE-INVALID", "release", f"Forbidden symlink or bytecode file in bundle: {p.relative_to(bundle_real)}")
                        unlisted_problem = True
                        break
                    present.add(str(p.relative_to(bundle_real)))
                if unlisted_problem:
                    break
            if not unlisted_problem:
                extra = sorted(present - (set(files.keys()) | {"deploy/BUNDLE-MANIFEST.json", "docs/SOURCE-MANIFEST.json"}))
                if extra:
                    add_error(errors, "PREFLIGHT-BUNDLE-INVALID", "release", f"Unlisted file(s) present in bundle: {', '.join(extra[:5])}")
                else:
                    info["manifest_files_checked"] = True

    # Inspect bundle's bot-plugin manifest and __init__.py version consistency.
    bp_yaml = bundle_real / "bot-plugin/plugin.yaml"
    bp_init = bundle_real / "bot-plugin/__init__.py"
    if bp_yaml.is_file() and not bp_yaml.is_symlink():
        scalars, yprobs = parse_simple_yaml_scalars(bp_yaml.read_text(encoding="utf-8", errors="replace"))
        if yprobs or not scalars.get("name"):
            add_error(errors, "PREFLIGHT-BUNDLE-INVALID", "release", "Bundle bot-plugin/plugin.yaml is invalid or missing name.")
        else:
            info["bundle_plugin_name"] = scalars.get("name")
            info["bundle_plugin_version"] = scalars.get("version")
            info["bundle_plugin_init_version"] = read_init_version(bp_init)
            if info["bundle_plugin_version"] and info["bundle_plugin_init_version"] and info["bundle_plugin_version"] != info["bundle_plugin_init_version"]:
                add_error(
                    errors,
                    "PREFLIGHT-BUNDLE-PLUGIN-VERSION-MISMATCH",
                    "release",
                    f"Bundle bot-plugin/plugin.yaml version ({info['bundle_plugin_version']}) disagrees with bot-plugin/__init__.py ({info['bundle_plugin_init_version']}).",
                )

    if expected_digest is not None:
        norm = expected_digest.strip().lower()
        if not HEX64_RE.fullmatch(norm) or not hmac.compare_digest(norm, computed_tree):
            add_error(errors, "PREFLIGHT-RELEASE-DIGEST-MISMATCH", "release", "Expected release digest does not match bundle treeSha256.")

    if expected_version is not None and expected_version != pkg_ver:
        add_error(errors, "PREFLIGHT-RELEASE-VERSION-MISMATCH", "release", "Expected release version does not match bundle package.json version.")

    # Check release.env
    archive_sha_expected: str | None = None
    if release_env_path is None:
        if mode == "upgrade":
            info["release_env_status"] = "missing"
            add_error(errors, "PREFLIGHT-RELEASE-ENV-MISSING", "release", "--release-env is required in upgrade mode.")
        else:
            if expected_digest is None:
                info["release_env_status"] = "missing"
                add_error(errors, "PREFLIGHT-RELEASE-ENV-MISSING", "release", "Either --release-env or --expected-digest is required in install mode.")
            else:
                info["release_env_status"] = "checked-via-expected-digest"
    else:
        try:
            st = os.lstat(release_env_path)
        except OSError:
            info["release_env_status"] = "missing"
            add_error(errors, "PREFLIGHT-RELEASE-ENV-UNSAFE", "release", "release.env does not exist or cannot be stat'd.")
            return info

        if stat.S_ISLNK(st.st_mode) or not stat.S_ISREG(st.st_mode):
            info["release_env_status"] = "unsafe"
            add_error(errors, "PREFLIGHT-RELEASE-ENV-UNSAFE", "release", "release.env must be a regular non-symlink file.")
            return info
        if stat.S_IMODE(st.st_mode) & 0o002:
            info["release_env_status"] = "unsafe"
            add_error(errors, "PREFLIGHT-RELEASE-ENV-UNSAFE", "release", "release.env must not be world-writable.")
            return info

        env_vals, parse_problems = parse_release_env(release_env_path)
        if parse_problems:
            info["release_env_status"] = "parse-error"
            add_error(errors, "PREFLIGHT-RELEASE-ENV-PARSE", "release", "; ".join(parse_problems))
            return info

        d1 = env_vals.get("LIBETECH_BUILD_DIGEST")
        d2 = env_vals.get("LIBETECH_BUNDLE_TREE_SHA256")
        if d1 is not None and d2 is not None and d1.lower() != d2.lower():
            add_error(errors, "PREFLIGHT-RELEASE-DIGEST-CONFLICT", "release", "LIBETECH_BUILD_DIGEST and LIBETECH_BUNDLE_TREE_SHA256 disagree in release.env.")
        rel_digest = (d1 or d2 or "").strip().lower()
        if not HEX64_RE.fullmatch(rel_digest) or not hmac.compare_digest(rel_digest, computed_tree):
            add_error(errors, "PREFLIGHT-RELEASE-DIGEST-MISMATCH", "release", "release.env digest is missing, malformed, or does not match bundle treeSha256.")

        v1 = env_vals.get("LIBETECH_RELEASE_VERSION")
        v2 = env_vals.get("RELEASE_VERSION")
        if v1 is not None and v2 is not None and v1 != v2:
            add_error(errors, "PREFLIGHT-RELEASE-VERSION-CONFLICT", "release", "LIBETECH_RELEASE_VERSION and RELEASE_VERSION disagree in release.env.")
        rel_ver = v1 or v2
        if not rel_ver or rel_ver != pkg_ver:
            add_error(errors, "PREFLIGHT-RELEASE-VERSION-MISMATCH", "release", "release.env version is missing or does not match bundle version.")

        rel_plugin_ver = env_vals.get("LIBETECH_PLUGIN_VERSION")
        if rel_plugin_ver is not None and info["bundle_plugin_version"] and rel_plugin_ver != info["bundle_plugin_version"]:
            add_error(
                errors,
                "PREFLIGHT-RELEASE-PLUGIN-VERSION-MISMATCH",
                "release",
                f"release.env LIBETECH_PLUGIN_VERSION ({rel_plugin_ver}) does not match bundle bot-plugin version ({info['bundle_plugin_version']}).",
            )

        src_sha = env_vals.get("SOURCE_SHA")
        if src_sha is not None and not HEX40_RE.fullmatch(src_sha):
            add_error(errors, "PREFLIGHT-RELEASE-SOURCE-SHA-INVALID", "release", "release.env SOURCE_SHA must be 40 lowercase hex digits.")

        arch_sha = env_vals.get("LIBETECH_ARCHIVE_SHA256")
        if arch_sha is not None:
            if not HEX64_RE.fullmatch(arch_sha.lower()):
                add_error(errors, "PREFLIGHT-RELEASE-ARCHIVE-SHA-INVALID", "release", "release.env LIBETECH_ARCHIVE_SHA256 must be 64 hex digits.")
            else:
                archive_sha_expected = arch_sha.lower()

        info["release_env_keys_checked"] = sorted(env_vals.keys())
        info["release_env_status"] = "verified"

    if archive_path is not None:
        expected_arch = archive_sha_expected or (os.environ.get("LIBETECH_ARCHIVE_SHA256", "").strip().lower() or None)
        if not expected_arch or not HEX64_RE.fullmatch(expected_arch):
            add_error(errors, "PREFLIGHT-ARCHIVE-SHA-MISMATCH", "release", "Archive SHA-256 expected value is missing or malformed.")
        elif archive_path.is_symlink() or not archive_path.is_file():
            add_error(errors, "PREFLIGHT-ARCHIVE-SHA-MISMATCH", "release", "Archive path is not a regular non-symlink file.")
        elif not hmac.compare_digest(sha256_file(archive_path), expected_arch):
            add_error(errors, "PREFLIGHT-ARCHIVE-SHA-MISMATCH", "release", "Archive SHA-256 does not match expected digest.")

    return info


def resolve_scan_dirs(
    explicit_dirs: list[str] | None,
    hermes_root: Path,
    hermes_profile: Path,
    mode: str,
) -> list[tuple[Path, bool]]:
    """Return ordered list of (scan_dir, required) deduplicated by canonical realpath."""
    raw: list[tuple[Path, bool]]
    if explicit_dirs:
        raw = [(Path(d), True) for d in explicit_dirs]
    else:
        raw = [
            (hermes_profile / "plugins", mode == "upgrade"),
            (hermes_root / "plugins", False),
            (hermes_root / "hermes-agent/plugins", False),
        ]
    seen: set[Path] = set()
    out: list[tuple[Path, bool]] = []
    for path, required in raw:
        canon = Path(os.path.realpath(path))
        if canon in seen:
            continue
        seen.add(canon)
        out.append((path, required))
    return out


def check_plugins_and_backups(
    scan_specs: list[tuple[Path, bool]],
    *,
    mode: str,
    precedence: str,
    bundle_plugin_name: str | None,
    backup_dirs: list[Path],
    hermes_root: Path,
    errors: list[dict],
    warnings: list[dict],
) -> tuple[dict, dict]:
    """Checks (a) duplicate Hermes plugins + winner and (e) backup dir outside scan paths."""
    plugin_info: dict = {
        "precedence_model": precedence,
        "scan_dirs": [],
        "discovered": [],
        "duplicates": [],
    }
    backup_info: dict = {
        "backup_dirs": [],
        "artifacts_in_scan_dirs": [],
    }

    canonical_scan_roots: list[Path] = []
    discovered: list[dict] = []
    artifacts_in_scan: list[dict] = []

    for scan_path, required in scan_specs:
        scan_real = Path(os.path.realpath(scan_path))
        canonical_scan_roots.append(scan_real)
        exists = scan_path.exists() and scan_path.is_dir()
        plugin_info["scan_dirs"].append({
            "path": str(scan_path),
            "realpath": str(scan_real),
            "exists": exists,
            "required": required,
        })
        if not exists:
            if required:
                add_error(errors, "PREFLIGHT-SCAN-DIR-MISSING", "plugins", f"Required Hermes plugin scan directory does not exist: {scan_path}")
            continue

        try:
            root_stat = os.stat(scan_path)
            root_id = (root_stat.st_dev, root_stat.st_ino)
        except OSError:
            add_error(errors, "PREFLIGHT-SCAN-DIR-MISSING", "plugins", f"Cannot stat Hermes plugin scan directory: {scan_path}")
            continue

        _walk_plugin_scan_dir(
            scan_root=scan_path,
            current=scan_path,
            depth=0,
            inside_plugin=False,
            ancestors=frozenset({root_id}),
            discovered=discovered,
            artifacts=artifacts_in_scan,
            errors=errors,
            warnings=warnings,
        )

    plugin_info["discovered"] = discovered
    by_name: dict[str, list[dict]] = {}
    for entry in discovered:
        by_name.setdefault(entry["name"], []).append(entry)

    duplicates: list[dict] = []
    for name in sorted(by_name.keys()):
        copies = by_name[name]
        if len(copies) > 1:
            winner = copies[-1] if precedence == "last-wins" else copies[0]
            shadowed = [c for c in copies if c is not winner]
            dup_entry = {
                "name": name,
                "count": len(copies),
                "precedence": precedence,
                "winner": winner,
                "shadowed": shadowed,
                "copies": copies,
            }
            duplicates.append(dup_entry)
            add_error(
                errors,
                "PREFLIGHT-PLUGIN-DUPLICATE",
                "plugins",
                f"Duplicate plugin '{name}' found ({len(copies)} copies); winner under {precedence}: {winner['path']} (version={winner['version']}).",
            )
    plugin_info["duplicates"] = duplicates

    if mode == "install" and bundle_plugin_name and bundle_plugin_name in by_name:
        paths = ", ".join(e["path"] for e in by_name[bundle_plugin_name])
        add_error(
            errors,
            "PREFLIGHT-PLUGIN-ALREADY-EXISTS",
            "plugins",
            f"Plugin '{bundle_plugin_name}' already exists in Hermes scan path(s): {paths}",
        )

    # Check (e): backup directories strictly outside scan roots + no backup artifacts in scan dirs.
    backup_info["artifacts_in_scan_dirs"] = artifacts_in_scan
    for art in artifacts_in_scan:
        add_error(
            errors,
            "PREFLIGHT-BACKUP-ARTIFACT-IN-SCAN-DIR",
            "backups",
            f"Backup-like entry inside Hermes plugin scan dir: {art['path']}",
        )

    if not backup_dirs:
        if mode == "upgrade":
            add_error(errors, "PREFLIGHT-BACKUP-DIR-MISSING", "backups", "--backup-dir (or LIBETECH_BACKUP_DIR) is required in upgrade mode.")
    else:
        hermes_real = Path(os.path.realpath(hermes_root))
        for bdir in backup_dirs:
            b_real = Path(os.path.realpath(bdir))
            entry = {"path": str(bdir), "realpath": str(b_real), "status": "ok"}
            for s_real in canonical_scan_roots:
                if b_real == s_real or b_real.is_relative_to(s_real):
                    entry["status"] = "fail"
                    add_error(
                        errors,
                        "PREFLIGHT-BACKUP-INSIDE-SCAN-DIR",
                        "backups",
                        f"Backup directory {bdir} resolves inside Hermes plugin scan directory {s_real}.",
                    )
                    break
                if s_real.is_relative_to(b_real):
                    entry["status"] = "fail"
                    add_error(
                        errors,
                        "PREFLIGHT-BACKUP-CONTAINS-SCAN-DIR",
                        "backups",
                        f"Backup directory {bdir} encloses Hermes plugin scan directory {s_real}.",
                    )
                    break
            if entry["status"] == "ok" and (b_real == hermes_real or b_real.is_relative_to(hermes_real)):
                warnings.append({
                    "code": "PREFLIGHT-BACKUP-INSIDE-HERMES-HOME",
                    "check": "backups",
                    "message": f"Backup directory {bdir} is inside Hermes home {hermes_real}; prefer a directory outside Hermes home.",
                })
            backup_info["backup_dirs"].append(entry)

    return plugin_info, backup_info


def _walk_plugin_scan_dir(
    *,
    scan_root: Path,
    current: Path,
    depth: int,
    inside_plugin: bool,
    ancestors: frozenset[tuple[int, int]],
    discovered: list[dict],
    artifacts: list[dict],
    errors: list[dict],
    warnings: list[dict],
) -> None:
    if depth >= MAX_PLUGIN_SCAN_DEPTH:
        warnings.append({
            "code": "PREFLIGHT-SCAN-DEPTH-LIMIT",
            "check": "plugins",
            "message": f"Stopped scanning deeper than {MAX_PLUGIN_SCAN_DEPTH} levels under {current}.",
        })
        return

    try:
        children = sorted(current.iterdir(), key=lambda p: p.name)
    except OSError:
        add_error(errors, "PREFLIGHT-SCAN-DIR-UNREADABLE", "plugins", f"Cannot list directory inside plugin scan path: {current}")
        return

    for child in children:
        name = child.name
        if name == "__pycache__":
            continue
        is_symlink = child.is_symlink()

        if not inside_plugin and depth <= 3 and BACKUP_ARTIFACT_RE.search(name):
            artifacts.append({"path": str(child), "scan_dir": str(scan_root), "name": name})

        try:
            st = os.stat(child)
        except OSError:
            warnings.append({
                "code": "PREFLIGHT-BROKEN-SYMLINK",
                "check": "plugins",
                "message": f"Unreadable entry or broken symlink in plugin scan dir: {child}",
            })
            continue

        if not stat.S_ISDIR(st.st_mode):
            continue

        node_id = (st.st_dev, st.st_ino)
        if node_id in ancestors:
            warnings.append({
                "code": "PREFLIGHT-SYMLINK-CYCLE",
                "check": "plugins",
                "message": f"Skipped cyclic symlink inside plugin scan dir: {child}",
            })
            continue

        manifest_path = child / "plugin.yaml"
        child_has_manifest = manifest_path.exists()
        if child_has_manifest:
            _record_plugin_manifest(
                scan_root=scan_root,
                plugin_dir=child,
                manifest_path=manifest_path,
                depth=depth + 1,
                is_symlink=is_symlink,
                discovered=discovered,
                errors=errors,
            )

        _walk_plugin_scan_dir(
            scan_root=scan_root,
            current=child,
            depth=depth + 1,
            inside_plugin=inside_plugin or child_has_manifest,
            ancestors=ancestors | {node_id},
            discovered=discovered,
            artifacts=artifacts,
            errors=errors,
            warnings=warnings,
        )


def _record_plugin_manifest(
    *,
    scan_root: Path,
    plugin_dir: Path,
    manifest_path: Path,
    depth: int,
    is_symlink: bool,
    discovered: list[dict],
    errors: list[dict],
) -> None:
    try:
        text = manifest_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        add_error(errors, "PREFLIGHT-PLUGIN-MANIFEST-INVALID", "plugins", f"Cannot read plugin manifest: {manifest_path}")
        return

    scalars, problems = parse_simple_yaml_scalars(text)
    plugin_name = scalars.get("name", "").strip()
    if problems or not plugin_name:
        detail = "; ".join(problems) if problems else "missing top-level 'name'"
        add_error(errors, "PREFLIGHT-PLUGIN-MANIFEST-INVALID", "plugins", f"Invalid plugin manifest {manifest_path}: {detail}")
        return

    manifest_ver = scalars.get("version")
    init_path = plugin_dir / "__init__.py"
    code_ver = read_init_version(init_path)
    if manifest_ver and code_ver and manifest_ver != code_ver:
        add_error(
            errors,
            "PREFLIGHT-PLUGIN-VERSION-MISMATCH",
            "plugins",
            f"Plugin '{plugin_name}' at {plugin_dir}: plugin.yaml version ({manifest_ver}) disagrees with __init__.py VERSION ({code_ver}).",
        )

    discovered.append({
        "name": plugin_name,
        "version": manifest_ver,
        "code_version": code_ver,
        "path": str(plugin_dir),
        "realpath": os.path.realpath(plugin_dir),
        "is_symlink": is_symlink,
        "scan_dir": str(scan_root),
        "depth": depth,
        "sha256_manifest": sha256_file(manifest_path),
        "sha256_init": sha256_file(init_path) if init_path.is_file() else None,
    })


def _parse_db_url_to_env(url: str) -> dict[str, str]:
    parsed = urlsplit(url)
    if parsed.scheme not in ("postgres", "postgresql"):
        raise ValueError("unsupported database URL scheme")
    env: dict[str, str] = {}
    if parsed.hostname:
        env["PGHOST"] = unquote(parsed.hostname)
    if parsed.port:
        env["PGPORT"] = str(parsed.port)
    if parsed.username is not None:
        env["PGUSER"] = unquote(parsed.username)
    if parsed.password is not None:
        env["PGPASSWORD"] = unquote(parsed.password)
    if parsed.path and parsed.path != "/":
        env["PGDATABASE"] = unquote(parsed.path.lstrip("/"))
    qs = parse_qs(parsed.query)
    if "host" in qs and qs["host"]:
        env["PGHOST"] = qs["host"][0]
    if "sslmode" in qs and qs["sslmode"]:
        env["PGSSLMODE"] = qs["sslmode"][0]
    return env


def _resolve_psql(explicit_bin: str | None) -> tuple[str | None, str | None]:
    if explicit_bin:
        p = Path(explicit_bin)
        if p.is_file() and os.access(p, os.X_OK):
            return str(p), None
        return None, None
    found = shutil.which("psql")
    if found:
        return found, None
    if DEFAULT_USER_PSQL.is_file() and os.access(DEFAULT_USER_PSQL, os.X_OK):
        return str(DEFAULT_USER_PSQL), str(DEFAULT_USER_PGLIB)
    return None, None


def _run_psql_readonly(psql_bin: str, pgenv: dict[str, str], sql: str) -> tuple[int, str]:
    cmd = [
        psql_bin,
        "-X",
        "-q",
        "-At",
        "-v",
        "ON_ERROR_STOP=1",
        "-v",
        "VERBOSITY=terse",
        "-v",
        "SHOW_CONTEXT=never",
        "-f",
        "-",
    ]
    res = subprocess.run(cmd, input=sql, text=True, capture_output=True, env=pgenv, timeout=20, check=False)
    return res.returncode, res.stdout


def check_migration_ledger(
    bundle: Path,
    *,
    mode: str,
    psql_bin_arg: str | None,
    db_url_env: str,
    pg_host: str | None,
    pg_port: str | None,
    pg_user: str | None,
    pg_db: str | None,
    expected_schema_max: str | None,
    require_current: bool,
    skip_db_check: bool,
    errors: list[dict],
) -> dict:
    """Check (c): bundle migration files/rollbacks and PostgreSQL schema_migrations ledger."""
    info: dict = {
        "bundle_versions": [],
        "missing_rollbacks": [],
        "bundle_gaps": [],
        "bundle_duplicates": [],
        "db_status": "not-checked",
        "applied": None,
        "pending": None,
        "unknown_applied": None,
        "gaps": None,
    }

    mig_dir = bundle / "migrations"
    rb_dir = mig_dir / "rollback"
    if not mig_dir.is_dir():
        add_error(errors, "PREFLIGHT-MIGRATION-EMPTY", "migration_ledger", "Bundle is missing migrations/ directory.")
        return info

    mig_files = sorted(f.name for f in mig_dir.iterdir() if f.is_file() and MIGRATION_FILE_RE.match(f.name))
    if not mig_files:
        add_error(errors, "PREFLIGHT-MIGRATION-EMPTY", "migration_ledger", "No numbered migration SQL files found in bundle.")
        return info

    seen_versions: dict[str, list[str]] = {}
    seen_nums: dict[int, list[str]] = {}
    for fname in mig_files:
        ver = MIGRATION_FILE_RE.match(fname).group(1)  # type: ignore[union-attr]
        seen_versions.setdefault(ver, []).append(fname)
        seen_nums.setdefault(int(ver), []).append(fname)

    dup_nums = {n: fs for n, fs in seen_nums.items() if len(fs) > 1}
    if dup_nums:
        info["bundle_duplicates"] = [f"{n:03d}" for n in sorted(dup_nums.keys())]
        add_error(
            errors,
            "PREFLIGHT-MIGRATION-DUPLICATE",
            "migration_ledger",
            f"Duplicate migration version number(s) in bundle: {', '.join(info['bundle_duplicates'])}",
        )

    bundle_versions = sorted(seen_versions.keys(), key=lambda v: (int(v), v))
    info["bundle_versions"] = bundle_versions

    # Check contiguous numbering from 1..max (e.g., 001..032), including missing 001.
    nums = sorted(seen_nums.keys())
    if nums:
        width = max(3, len(bundle_versions[0]))
        bundle_gaps = [str(i).zfill(width) for i in range(1, nums[-1] + 1) if i not in seen_nums]
        if bundle_gaps:
            info["bundle_gaps"] = bundle_gaps
            add_error(
                errors,
                "PREFLIGHT-MIGRATION-GAP",
                "migration_ledger",
                f"Gap(s) in bundle migration numbering: {', '.join(bundle_gaps)}",
            )

    # Also verify bundle migrations match BUNDLE-MANIFEST.json even if --skip-bundle-file-hashes was used.
    manifest_path = bundle / "deploy/BUNDLE-MANIFEST.json"
    if manifest_path.is_file() and not manifest_path.is_symlink():
        try:
            manifest_files = json.loads(manifest_path.read_text(encoding="utf-8")).get("files", {})
            if isinstance(manifest_files, dict):
                listed = {n for n in manifest_files if re.fullmatch(r"migrations/\d+[^/]*\.sql", n)}
                present = {"migrations/" + f for f in mig_files}
                if listed != present:
                    add_error(
                        errors,
                        "PREFLIGHT-MIGRATION-MANIFEST-MISMATCH",
                        "migration_ledger",
                        "Bundle migrations/ files do not match BUNDLE-MANIFEST.json.",
                    )
        except (OSError, ValueError):
            pass

    # Check rollback files required from migration 013 onward (OQ-20 / AGENTS.md).
    missing_rb: list[str] = []
    for fname in mig_files:
        ver_num = int(MIGRATION_FILE_RE.match(fname).group(1))  # type: ignore[union-attr]
        if ver_num >= 13 and not (rb_dir / fname).is_file():
            missing_rb.append(fname)
    if missing_rb:
        info["missing_rollbacks"] = missing_rb
        add_error(
            errors,
            "PREFLIGHT-MIGRATION-MISSING-ROLLBACK",
            "migration_ledger",
            f"Missing rollback file(s) under migrations/rollback/: {', '.join(missing_rb)}",
        )

    # Decide whether to query live PostgreSQL ledger.
    db_url = os.environ.get(db_url_env)
    if not db_url and db_url_env == "PREFLIGHT_DATABASE_URL":
        db_url = os.environ.get("MIGRATION_DATABASE_URL")
    has_pg_flags = any(x is not None for x in (pg_host, pg_port, pg_user, pg_db))
    has_pg_env = bool(os.environ.get("PGDATABASE"))

    if skip_db_check:
        info["db_status"] = "skipped"
        return info

    if mode == "install" and not (db_url or has_pg_flags or has_pg_env):
        info["db_status"] = "not-applicable-initial-install"
        return info

    if not (db_url or has_pg_flags or has_pg_env):
        info["db_status"] = "missing-config"
        add_error(
            errors,
            "PREFLIGHT-LEDGER-DB-REQUIRED",
            "migration_ledger",
            f"Database connection is required for ledger check (set {db_url_env} or PG* flags, or pass --skip-db-check).",
        )
        return info

    psql_bin, extra_ld = _resolve_psql(psql_bin_arg)
    if not psql_bin:
        info["db_status"] = "psql-missing"
        add_error(errors, "PREFLIGHT-LEDGER-PSQL-MISSING", "migration_ledger", "psql executable not found for migration ledger check.")
        return info

    pgenv: dict[str, str] = {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "HOME": os.environ.get("HOME", "/tmp"),
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "PGCONNECT_TIMEOUT": "10",
    }
    for key in ("PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE", "LD_LIBRARY_PATH"):
        if key in os.environ:
            pgenv[key] = os.environ[key]
    if extra_ld:
        pgenv["LD_LIBRARY_PATH"] = extra_ld + (":" + pgenv["LD_LIBRARY_PATH"] if pgenv.get("LD_LIBRARY_PATH") else "")

    if db_url:
        try:
            pgenv.update(_parse_db_url_to_env(db_url))
        except ValueError:
            info["db_status"] = "invalid-url"
            add_error(errors, "PREFLIGHT-LEDGER-DB-ERROR", "migration_ledger", "Invalid database connection URL format.")
            return info

    if pg_host:
        pgenv["PGHOST"] = pg_host
    if pg_port:
        pgenv["PGPORT"] = pg_port
    if pg_user:
        pgenv["PGUSER"] = pg_user
    if pg_db:
        pgenv["PGDATABASE"] = pg_db

    # Defense-in-depth read-only enforcement.
    existing_opts = os.environ.get("PGOPTIONS", "").strip()
    pgenv["PGOPTIONS"] = (existing_opts + " -c default_transaction_read_only=on").strip()

    try:
        rc1, out1 = _run_psql_readonly(
            psql_bin,
            pgenv,
            "BEGIN READ ONLY;\nSELECT to_regclass('public.schema_migrations') IS NOT NULL;\nCOMMIT;\n",
        )
    except (OSError, subprocess.TimeoutExpired):
        info["db_status"] = "error"
        add_error(errors, "PREFLIGHT-LEDGER-DB-ERROR", "migration_ledger", "Failed to execute psql for migration ledger check.")
        return info

    if rc1 != 0:
        info["db_status"] = "error"
        add_error(errors, "PREFLIGHT-LEDGER-DB-ERROR", "migration_ledger", f"psql failed while checking schema_migrations (exit {rc1}).")
        return info

    table_flag = out1.strip().splitlines()[-1].strip() if out1.strip() else ""
    if table_flag != "t":
        info["db_status"] = "missing-table"
        add_error(errors, "PREFLIGHT-LEDGER-TABLE-MISSING", "migration_ledger", "public.schema_migrations table does not exist in target database.")
        return info

    try:
        rc2, out2 = _run_psql_readonly(
            psql_bin,
            pgenv,
            "BEGIN READ ONLY;\nSELECT version FROM public.schema_migrations ORDER BY version;\nCOMMIT;\n",
        )
    except (OSError, subprocess.TimeoutExpired):
        info["db_status"] = "error"
        add_error(errors, "PREFLIGHT-LEDGER-DB-ERROR", "migration_ledger", "Failed to read applied versions from schema_migrations.")
        return info

    if rc2 != 0:
        info["db_status"] = "error"
        add_error(errors, "PREFLIGHT-LEDGER-DB-ERROR", "migration_ledger", f"psql failed while reading schema_migrations (exit {rc2}).")
        return info

    applied = [line.strip() for line in out2.splitlines() if line.strip()]
    if any(not re.fullmatch(r"\d+", v) for v in applied):
        info["db_status"] = "error"
        add_error(errors, "PREFLIGHT-LEDGER-DB-ERROR", "migration_ledger", "Unexpected non-numeric version row in schema_migrations.")
        return info

    applied = sorted(set(applied), key=lambda v: (int(v), v))
    applied_set = set(applied)
    bundle_set = set(bundle_versions)

    unknown_applied = [v for v in applied if v not in bundle_set]
    pending = [v for v in bundle_versions if v not in applied_set]

    # Gaps: any bundle version earlier than the highest applied bundle version that is missing from applied.
    applied_bundle_indices = [i for i, v in enumerate(bundle_versions) if v in applied_set]
    gaps: list[str] = []
    if applied_bundle_indices:
        max_idx = max(applied_bundle_indices)
        gaps = [v for v in bundle_versions[: max_idx + 1] if v not in applied_set]

    info["db_status"] = "checked"
    info["applied"] = applied
    info["pending"] = pending
    info["unknown_applied"] = unknown_applied
    info["gaps"] = gaps

    if unknown_applied:
        add_error(
            errors,
            "PREFLIGHT-LEDGER-UNKNOWN-APPLIED",
            "migration_ledger",
            f"Database has migration(s) unknown to this bundle: {', '.join(unknown_applied)}",
        )
    if gaps:
        add_error(
            errors,
            "PREFLIGHT-LEDGER-GAP",
            "migration_ledger",
            f"Database schema_migrations has missing gap version(s): {', '.join(gaps)}",
        )
    if expected_schema_max is not None:
        actual_max = applied[-1] if applied else None
        if actual_max != expected_schema_max:
            add_error(
                errors,
                "PREFLIGHT-LEDGER-UNEXPECTED-STATE",
                "migration_ledger",
                f"Expected highest applied migration {expected_schema_max}, observed {actual_max}.",
            )
    if require_current and pending:
        add_error(
            errors,
            "PREFLIGHT-LEDGER-PENDING",
            "migration_ledger",
            f"Pending migration(s) not yet applied: {', '.join(pending)}",
        )

    return info


def _parse_systemd_service(unit_path: Path) -> dict:
    """Parse [Service] User=/Group= including .d/*.conf drop-ins. Fails closed on unreadable files."""
    if unit_path.is_symlink() and os.path.realpath(unit_path) == "/dev/null":
        return {"masked": True, "unreadable": False, "declared_user": None, "declared_group": None, "user_directive_seen": False, "group_directive_seen": False, "dropins": []}

    files = [unit_path]
    dropin_dir = Path(str(unit_path) + ".d")
    dropin_names: list[str] = []
    if dropin_dir.is_dir():
        try:
            confs = sorted(dropin_dir.glob("*.conf"), key=lambda p: p.name)
        except OSError:
            return {"masked": False, "unreadable": True, "declared_user": None, "declared_group": None, "user_directive_seen": False, "group_directive_seen": False, "dropins": []}
        for conf in confs:
            files.append(conf)
            dropin_names.append(conf.name)

    declared_user: str | None = None
    declared_group: str | None = None
    user_seen = False
    group_seen = False

    for fpath in files:
        section = ""
        try:
            text = fpath.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return {"masked": False, "unreadable": True, "declared_user": None, "declared_group": None, "user_directive_seen": False, "group_directive_seen": False, "dropins": dropin_names}
        for raw in text.splitlines():
            line = raw.strip()
            if not line or line.startswith(("#", ";")):
                continue
            if line.startswith("[") and line.endswith("]"):
                section = line[1:-1].strip()
                continue
            if section != "Service" or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip()
            if key == "User":
                user_seen = True
                declared_user = val if val else None
            elif key == "Group":
                group_seen = True
                declared_group = val if val else None

    return {
        "masked": False,
        "unreadable": False,
        "declared_user": declared_user,
        "declared_group": declared_group,
        "user_directive_seen": user_seen,
        "group_directive_seen": group_seen,
        "dropins": dropin_names,
    }


def check_systemd_units(
    bundle: Path,
    *,
    mode: str,
    system_unit_dir: Path,
    user_unit_dir: Path,
    user_unit_owner: str,
    expected_web_user: str | None,
    expected_unit_users: dict[str, str],
    errors: list[dict],
) -> dict:
    """Check (d): which user each systemd unit runs as; block root system units & dual-scope collisions."""
    info: dict = {
        "system_unit_dir": str(system_unit_dir),
        "user_unit_dir": str(user_unit_dir),
        "user_unit_owner": user_unit_owner,
        "units": [],
    }

    system_found: dict[str, dict] = {}
    user_found: dict[str, dict] = {}

    if system_unit_dir.is_dir():
        for unit in sorted(system_unit_dir.glob("libetech-*.service"), key=lambda p: p.name):
            parsed = _parse_systemd_service(unit)
            if parsed["masked"]:
                rec = {"unit": unit.name, "scope": "system", "path": str(unit), "masked": True, "effective_user": None, "status": "masked"}
                system_found[unit.name] = rec
                info["units"].append(rec)
                continue
            if parsed["unreadable"]:
                add_error(errors, "PREFLIGHT-UNIT-UNREADABLE", "units", f"Cannot read system unit or its drop-in(s): {unit}")
                rec = {"unit": unit.name, "scope": "system", "path": str(unit), "effective_user": None, "status": "fail"}
                system_found[unit.name] = rec
                info["units"].append(rec)
                continue
            eff = parsed["declared_user"] or "root"
            status = "ok"
            if eff in ("root", "0"):
                status = "fail"
                add_error(
                    errors,
                    "PREFLIGHT-UNIT-RUNS-AS-ROOT",
                    "units",
                    f"System unit {unit.name} runs as '{eff}' (missing or root User= directive).",
                )
            rec = {
                "unit": unit.name,
                "scope": "system",
                "path": str(unit),
                "declared_user": parsed["declared_user"],
                "declared_group": parsed["declared_group"],
                "effective_user": eff,
                "dropins": parsed["dropins"],
                "status": status,
            }
            system_found[unit.name] = rec
            info["units"].append(rec)

    if user_unit_dir.is_dir():
        for unit in sorted(user_unit_dir.glob("libetech-*.service"), key=lambda p: p.name):
            parsed = _parse_systemd_service(unit)
            if parsed["masked"]:
                rec = {"unit": unit.name, "scope": "user", "path": str(unit), "masked": True, "effective_user": None, "status": "masked"}
                user_found[unit.name] = rec
                info["units"].append(rec)
                continue
            if parsed["unreadable"]:
                add_error(errors, "PREFLIGHT-UNIT-UNREADABLE", "units", f"Cannot read user unit or its drop-in(s): {unit}")
                rec = {"unit": unit.name, "scope": "user", "path": str(unit), "effective_user": None, "status": "fail"}
                user_found[unit.name] = rec
                info["units"].append(rec)
                continue
            status = "ok"
            if parsed["user_directive_seen"] or parsed["group_directive_seen"]:
                status = "fail"
                add_error(
                    errors,
                    "PREFLIGHT-USER-UNIT-INVALID-DIRECTIVE",
                    "units",
                    f"systemd --user unit {unit.name} must not set User= or Group=.",
                )
            if user_unit_owner in ("root", "0"):
                status = "fail"
                add_error(
                    errors,
                    "PREFLIGHT-UNIT-RUNS-AS-ROOT",
                    "units",
                    f"User unit {unit.name} cannot run under root owner.",
                )
            rec = {
                "unit": unit.name,
                "scope": "user",
                "path": str(unit),
                "declared_user": parsed["declared_user"],
                "declared_group": parsed["declared_group"],
                "effective_user": user_unit_owner,
                "dropins": parsed["dropins"],
                "status": status,
            }
            user_found[unit.name] = rec
            info["units"].append(rec)

    # Reject same unit name installed in both system and user scopes.
    for dup_name in sorted(set(system_found.keys()) & set(user_found.keys())):
        add_error(
            errors,
            "PREFLIGHT-UNIT-DUPLICATE-SCOPE",
            "units",
            f"Unit {dup_name} exists in both system ({system_unit_dir}) and user ({user_unit_dir}) directories.",
        )

    # Inspect bundle's web service template in install mode (and always validate it is non-root).
    bundle_web_unit = bundle / "deploy/libetech-ai-os.service"
    if mode == "install":
        if not bundle_web_unit.is_file():
            add_error(errors, "PREFLIGHT-UNIT-MISSING", "units", "Bundle is missing deploy/libetech-ai-os.service.")
        else:
            parsed = _parse_systemd_service(bundle_web_unit)
            eff = parsed["declared_user"] or "root"
            status = "ok"
            if eff in ("root", "0"):
                status = "fail"
                add_error(errors, "PREFLIGHT-UNIT-RUNS-AS-ROOT", "units", "Bundle deploy/libetech-ai-os.service runs as root.")
            target_user = expected_web_user or "libetech-os"
            if eff != target_user:
                status = "fail"
                add_error(
                    errors,
                    "PREFLIGHT-UNIT-USER-MISMATCH",
                    "units",
                    f"Bundle deploy/libetech-ai-os.service runs as '{eff}', expected '{target_user}'.",
                )
            info["units"].append({
                "unit": "libetech-ai-os.service",
                "scope": "bundle",
                "path": str(bundle_web_unit),
                "declared_user": parsed["declared_user"],
                "declared_group": parsed["declared_group"],
                "effective_user": eff,
                "status": status,
            })
        if "libetech-ai-os.service" in system_found or "libetech-ai-os.service" in user_found:
            add_error(
                errors,
                "PREFLIGHT-UNIT-ALREADY-EXISTS",
                "units",
                "libetech-ai-os.service already exists on this host; use upgrade mode instead of initial install.",
            )
    else:
        expectations = dict(expected_unit_users)
        if expected_web_user:
            expectations.setdefault("libetech-ai-os.service", expected_web_user)
        active = {**system_found, **user_found}
        for unit_name, want_user in sorted(expectations.items()):
            found = active.get(unit_name)
            if not found or found.get("masked"):
                add_error(errors, "PREFLIGHT-UNIT-MISSING", "units", f"Expected unit {unit_name} is not installed.")
                continue
            if found.get("effective_user") != want_user:
                add_error(
                    errors,
                    "PREFLIGHT-UNIT-USER-MISMATCH",
                    "units",
                    f"Unit {unit_name} runs as '{found.get('effective_user')}', expected '{want_user}'.",
                )

    return info


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="LibeTech AI OS pre-install / pre-upgrade preflight checks.")
    parser.add_argument("--mode", choices=("install", "upgrade"), default="upgrade")
    parser.add_argument("--bundle", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--plugin-scan-dir", action="append", dest="plugin_scan_dirs", default=[])
    parser.add_argument("--hermes-root", type=Path, default=DEFAULT_HERMES_ROOT)
    parser.add_argument("--hermes-profile", type=Path, default=None)
    parser.add_argument("--precedence", choices=("last-wins", "first-wins"), default="last-wins")
    parser.add_argument("--release-env", type=Path, default=None)
    parser.add_argument("--expected-digest", default=None)
    parser.add_argument("--expected-version", default=None)
    parser.add_argument("--archive", type=Path, default=None)
    parser.add_argument("--skip-bundle-file-hashes", action="store_true")
    parser.add_argument("--backup-dir", action="append", dest="backup_dirs", default=[])
    parser.add_argument("--system-unit-dir", type=Path, default=DEFAULT_SYSTEM_UNIT_DIR)
    parser.add_argument("--user-unit-dir", type=Path, default=DEFAULT_USER_UNIT_DIR)
    parser.add_argument("--user-unit-owner", default=DEFAULT_USER_UNIT_OWNER)
    parser.add_argument("--expected-web-user", default=None)
    parser.add_argument("--expected-unit-user", action="append", dest="expected_unit_users", default=[])
    parser.add_argument("--psql-bin", default=None)
    parser.add_argument("--db-url-env", default="PREFLIGHT_DATABASE_URL")
    parser.add_argument("--pg-host", default=None)
    parser.add_argument("--pg-port", default=None)
    parser.add_argument("--pg-user", default=None)
    parser.add_argument("--pg-db", default=None)
    parser.add_argument("--expected-schema-max", default=None)
    parser.add_argument("--require-migrations-current", action="store_true")
    parser.add_argument("--skip-db-check", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    hermes_profile = args.hermes_profile or (args.hermes_root / "profiles/libetech")
    release_env_path = args.release_env
    if release_env_path is None and os.environ.get("LIBETECH_RELEASE_ENV"):
        release_env_path = Path(os.environ["LIBETECH_RELEASE_ENV"])

    backup_dirs = [Path(b) for b in args.backup_dirs]
    if not backup_dirs and os.environ.get("LIBETECH_BACKUP_DIR"):
        backup_dirs = [Path(os.environ["LIBETECH_BACKUP_DIR"])]

    expected_unit_users: dict[str, str] = {}
    for spec in args.expected_unit_users:
        if "=" not in spec:
            parser.error("--expected-unit-user must be UNIT=USER")
        u_name, u_user = spec.split("=", 1)
        expected_unit_users[u_name.strip()] = u_user.strip()

    errors: list[dict] = []
    warnings: list[dict] = []

    release_info = check_bundle_and_release(
        args.bundle,
        mode=args.mode,
        release_env_path=release_env_path,
        expected_digest=args.expected_digest,
        expected_version=args.expected_version,
        archive_path=args.archive,
        verify_files=not args.skip_bundle_file_hashes,
        errors=errors,
    )

    scan_specs = resolve_scan_dirs(args.plugin_scan_dirs or None, args.hermes_root, hermes_profile, args.mode)
    plugin_info, backup_info = check_plugins_and_backups(
        scan_specs,
        mode=args.mode,
        precedence=args.precedence,
        bundle_plugin_name=release_info.get("bundle_plugin_name"),
        backup_dirs=backup_dirs,
        hermes_root=args.hermes_root,
        errors=errors,
        warnings=warnings,
    )

    ledger_info = check_migration_ledger(
        args.bundle,
        mode=args.mode,
        psql_bin_arg=args.psql_bin,
        db_url_env=args.db_url_env,
        pg_host=args.pg_host,
        pg_port=args.pg_port,
        pg_user=args.pg_user,
        pg_db=args.pg_db,
        expected_schema_max=args.expected_schema_max,
        require_current=args.require_migrations_current,
        skip_db_check=args.skip_db_check,
        errors=errors,
    )

    unit_info = check_systemd_units(
        args.bundle,
        mode=args.mode,
        system_unit_dir=args.system_unit_dir,
        user_unit_dir=args.user_unit_dir,
        user_unit_owner=args.user_unit_owner,
        expected_web_user=args.expected_web_user,
        expected_unit_users=expected_unit_users,
        errors=errors,
    )

    report = {
        "ok": len(errors) == 0,
        "mode": args.mode,
        "checks": {
            "plugins": plugin_info,
            "release": release_info,
            "migration_ledger": ledger_info,
            "units": unit_info,
            "backups": backup_info,
        },
        "errors": errors,
        "warnings": warnings,
    }
    print(json.dumps(report, indent=2, sort_keys=False))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
