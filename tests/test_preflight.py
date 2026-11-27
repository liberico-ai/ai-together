"""V1 pre-install / pre-upgrade preflight checks (deploy/preflight.py + install-d1.sh)."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True

REPO_ROOT = Path(__file__).resolve().parents[1]
DEPLOY = REPO_ROOT / "deploy"
PREFLIGHT = DEPLOY / "preflight.py"


def make_bundle(
    root: Path,
    *,
    version: str = "0.9.8",
    manifest_version: str | None = None,
    plugin_version: str = "0.3.6",
    init_version: str | None = None,
    migrations: list[str] | None = None,
    rollbacks: list[str] | None = None,
    service_user: str = "libetech-os",
    extra_files: dict[str, bytes] | None = None,
) -> dict:
    """Create a realistic minimal release bundle matching scripts/package-release.py."""
    migrations = migrations if migrations is not None else [
        *(f"{i:03d}_m{i}.sql" for i in range(1, 13)),
        "013_project_registry.sql",
    ]
    rollbacks = rollbacks if rollbacks is not None else ["013_project_registry.sql"]
    init_ver = plugin_version if init_version is None else init_version

    files: dict[str, bytes] = {
        "package.json": json.dumps({"name": "libetech-ai-os", "version": version}).encode(),
        "bot-plugin/plugin.yaml": (
            f'name: libetech-ai-os-bridge\nversion: "{plugin_version}"\n'
            "description: Test bridge plugin\n"
            "provides_tools:\n  - libetech_os_read\n"
        ).encode(),
        "bot-plugin/__init__.py": f'VERSION = "{init_ver}"\n'.encode(),
        "deploy/libetech-ai-os.service": (
            "[Unit]\nDescription=LibeTech AI OS\n\n[Service]\n"
            f"User={service_user}\nGroup={service_user}\n"
            "ExecStart=/opt/libetech-ai-os/node/bin/node server.js\n"
        ).encode(),
        "deploy/pre-restore.sql": b"-- pre-restore\n",
        "deploy/post-restore.sql": b"-- post-restore\n",
        "deploy/restore-plan.py": b"# restore-plan\n",
        "deploy/preflight.py": b"# preflight placeholder\n",
    }
    for name in migrations:
        ver = name.split("_", 1)[0]
        files[f"migrations/{name}"] = (
            f"BEGIN;\nINSERT INTO schema_migrations(version) VALUES ('{ver}') ON CONFLICT DO NOTHING;\nCOMMIT;\n"
        ).encode()
    for name in rollbacks:
        files[f"migrations/rollback/{name}"] = b"BEGIN;\nCOMMIT;\n"
    if extra_files:
        files.update(extra_files)

    hashes: dict[str, str] = {}
    for rel, content in sorted(files.items()):
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        hashes[rel] = hashlib.sha256(content).hexdigest()

    tree_sha = hashlib.sha256(
        json.dumps(hashes, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    manifest = {
        "version": version if manifest_version is None else manifest_version,
        "createdAt": "2026-11-28T00:00:00+00:00",
        "kind": "source-tree-digest-not-git-commit",
        "treeSha256": tree_sha,
        "files": hashes,
    }
    (root / "deploy/BUNDLE-MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def write_plugin(
    directory: Path,
    *,
    name: str = "libetech-ai-os-bridge",
    version: str = "0.3.6",
    init_version: str | None = None,
    raw_yaml: str | None = None,
) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    if raw_yaml is not None:
        (directory / "plugin.yaml").write_text(raw_yaml)
    else:
        (directory / "plugin.yaml").write_text(
            f'name: {name}\nversion: "{version}"\nprovides_tools:\n  - libetech_os_read\n'
        )
    code_ver = version if init_version is None else init_version
    if code_ver is not None:
        (directory / "__init__.py").write_text(f'VERSION = "{code_ver}"\n')
    return directory


def write_release_env(path: Path, lines: list[str], mode: int = 0o600) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n")
    path.chmod(mode)
    return path


def write_fake_psql(
    path: Path,
    *,
    table_exists: bool = True,
    versions: list[str] | None = None,
    fail_stderr: str | None = None,
    capture_file: Path | None = None,
) -> Path:
    """Create a fake psql executable that records argv/env and answers read-only ledger queries."""
    versions = versions if versions is not None else ["001", "002"]
    script = f"""#!{sys.executable}
import json, os, sys
capture = {str(capture_file)!r}
sql = sys.stdin.read()
if capture != 'None':
    entry = {{
        "argv": sys.argv[1:],
        "pg_env": {{k: v for k, v in os.environ.items() if k.startswith("PG")}},
        "sql": sql,
    }}
    with open(capture, "a") as fh:
        fh.write(json.dumps(entry) + "\\n")
fail_stderr = {fail_stderr!r}
if fail_stderr is not None:
    sys.stderr.write(fail_stderr)
    sys.exit(2)
if "to_regclass('public.schema_migrations')" in sql:
    print("t" if {table_exists!r} else "f")
    sys.exit(0)
if "FROM public.schema_migrations" in sql:
    for v in {versions!r}:
        print(v)
    sys.exit(0)
sys.stderr.write("unexpected query\\n")
sys.exit(3)
"""
    path.write_text(script)
    path.chmod(0o700)
    return path


def run_preflight(args: list[str], env: dict[str, str] | None = None) -> tuple[int, dict | None, str, str]:
    run_env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": os.environ.get("HOME", "/tmp")}
    if env:
        run_env.update(env)
    proc = subprocess.run(
        [sys.executable, "-I", str(PREFLIGHT), *args],
        capture_output=True,
        text=True,
        env=run_env,
        check=False,
    )
    payload = None
    if proc.stdout.strip():
        try:
            payload = json.loads(proc.stdout)
        except json.JSONDecodeError:
            payload = None
    return proc.returncode, payload, proc.stdout, proc.stderr


class PreflightChecks(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.bundle = self.root / "bundle"
        self.manifest = make_bundle(self.bundle)
        self.scan_dir = self.root / "hermes/profiles/libetech/plugins"
        self.shared_scan_dir = self.root / "hermes/plugins"
        self.backup_dir = self.root / "backups"
        self.system_units = self.root / "etc/systemd/system"
        self.user_units = self.root / "home/iptech/.config/systemd/user"
        self.scan_dir.mkdir(parents=True)
        self.shared_scan_dir.mkdir(parents=True)
        self.backup_dir.mkdir(parents=True)
        self.system_units.mkdir(parents=True)
        self.user_units.mkdir(parents=True)
        write_plugin(self.scan_dir / "libetech-ai-os-bridge", version="0.3.6")
        write_plugin(self.scan_dir / "libetech-priority1", name="libetech-priority1", version="1.1.4")
        self.release_env = write_release_env(
            self.root / "config/release.env",
            [
                f'LIBETECH_BUILD_DIGEST={self.manifest["treeSha256"]}',
                "LIBETECH_RELEASE_VERSION=0.9.8",
                "LIBETECH_PLUGIN_VERSION=0.3.6",
            ],
        )
        (self.user_units / "libetech-ai-os.service").write_text(
            "[Unit]\nDescription=LibeTech AI OS\n[Service]\nExecStart=/opt/node server.js\n"
        )
        (self.user_units / "libetech-ai-os-outbox.service").write_text(
            "[Unit]\nDescription=Outbox\n[Service]\nExecStart=/usr/bin/python3 __init__.py --once\n"
        )
        self.capture = self.root / "psql-capture.jsonl"
        self.fake_psql = write_fake_psql(
            self.root / "fake-psql",
            versions=[f"{i:03d}" for i in range(1, 13)],
            capture_file=self.capture,
        )

    def tearDown(self):
        self.tmp.cleanup()

    def base_upgrade_args(self) -> list[str]:
        return [
            "--mode", "upgrade",
            "--bundle", str(self.bundle),
            "--plugin-scan-dir", str(self.scan_dir),
            "--plugin-scan-dir", str(self.shared_scan_dir),
            "--release-env", str(self.release_env),
            "--backup-dir", str(self.backup_dir),
            "--system-unit-dir", str(self.system_units),
            "--user-unit-dir", str(self.user_units),
            "--user-unit-owner", "iptech",
            "--expected-web-user", "iptech",
            "--psql-bin", str(self.fake_psql),
        ]

    def base_db_env(self) -> dict[str, str]:
        return {"PREFLIGHT_DATABASE_URL": "postgresql://ops_user:DB_SECRET_PASS_42@127.0.0.1:5547/libetech_ai_os"}

    # --- (a) Duplicate plugins & winner reporting (V1 primary acceptance criterion) ---

    def test_v1_duplicate_plugin_backup_makes_preflight_red_and_moving_outside_makes_it_green(self):
        """Incident D regression: 0.3.2 backup copy inside Hermes scan dir overrides 0.3.6."""
        dup_copy = write_plugin(self.scan_dir / "libetech-ai-os-bridge.bak-0.3.2", version="0.3.2")

        code, data, out, err = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code, 1, f"expected red preflight, got stdout={out} stderr={err}")
        self.assertIsNotNone(data)
        self.assertFalse(data["ok"])
        codes = {e["code"] for e in data["errors"]}
        self.assertIn("PREFLIGHT-PLUGIN-DUPLICATE", codes)
        dups = data["checks"]["plugins"]["duplicates"]
        self.assertEqual(len(dups), 1)
        self.assertEqual(dups[0]["name"], "libetech-ai-os-bridge")
        self.assertEqual(dups[0]["winner"]["version"], "0.3.2")
        self.assertTrue(dups[0]["winner"]["path"].endswith("libetech-ai-os-bridge.bak-0.3.2"))

        # Move the 0.3.2 backup copy OUTSIDE the Hermes scan dir into external backup_dir.
        shutil.move(str(dup_copy), str(self.backup_dir / "libetech-ai-os-bridge.bak-0.3.2"))

        code2, data2, out2, err2 = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code2, 0, f"expected green preflight after move, got stdout={out2} stderr={err2}")
        self.assertIsNotNone(data2)
        self.assertTrue(data2["ok"])
        self.assertEqual(data2["checks"]["plugins"]["duplicates"], [])

    def test_duplicate_plugin_across_two_scan_dirs_fails_and_respects_precedence_reporting(self):
        write_plugin(self.shared_scan_dir / "libetech-ai-os-bridge", version="0.3.2")

        code, data, _, _ = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code, 1)
        dup = data["checks"]["plugins"]["duplicates"][0]
        self.assertEqual(dup["precedence"], "last-wins")
        self.assertEqual(dup["winner"]["version"], "0.3.2")

        code_first, data_first, _, _ = run_preflight(
            self.base_upgrade_args() + ["--precedence", "first-wins"], self.base_db_env()
        )
        self.assertEqual(code_first, 1)
        dup_first = data_first["checks"]["plugins"]["duplicates"][0]
        self.assertEqual(dup_first["precedence"], "first-wins")
        self.assertEqual(dup_first["winner"]["version"], "0.3.6")

    def test_nested_copy_symlink_copy_and_symlink_cycle_are_handled(self):
        nested = write_plugin(self.scan_dir / "archive/libetech-ai-os-bridge", version="0.3.2")
        code, data, _, _ = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-PLUGIN-DUPLICATE", {e["code"] for e in data["errors"]})
        shutil.rmtree(nested.parent)

        # Symlink copy inside the same scan dir causes Hermes to see two entries with same name.
        link = self.scan_dir / "zzz-bridge-link"
        link.symlink_to(self.scan_dir / "libetech-ai-os-bridge")
        code2, data2, _, _ = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code2, 1)
        self.assertIn("PREFLIGHT-PLUGIN-DUPLICATE", {e["code"] for e in data2["errors"]})
        link.unlink()

        # Symlink cycle inside scan dir must not hang.
        cycle = self.scan_dir / "self-loop"
        cycle.symlink_to(self.scan_dir)
        code3, data3, _, _ = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertIsNotNone(data3)
        cycle.unlink()

    def test_plugin_yaml_malformed_or_version_skew_with_init_fails_closed(self):
        write_plugin(self.scan_dir / "broken-plugin", raw_yaml="description: missing name\n")
        code, data, _, _ = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-PLUGIN-MANIFEST-INVALID", {e["code"] for e in data["errors"]})
        shutil.rmtree(self.scan_dir / "broken-plugin")

        # Half-upgraded plugin: plugin.yaml says 0.3.6 while __init__.py still says 0.3.2.
        write_plugin(self.scan_dir / "libetech-ai-os-bridge", version="0.3.6", init_version="0.3.2")
        code2, data2, _, _ = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code2, 1)
        self.assertIn("PREFLIGHT-PLUGIN-VERSION-MISMATCH", {e["code"] for e in data2["errors"]})

    def test_duplicate_scan_root_alias_does_not_false_positive_and_missing_explicit_scan_dir_fails(self):
        alias = self.root / "scan-alias"
        alias.symlink_to(self.scan_dir)
        code, data, out, err = run_preflight(
            self.base_upgrade_args() + ["--plugin-scan-dir", str(alias)], self.base_db_env()
        )
        self.assertEqual(code, 0, f"stdout={out} stderr={err}")
        self.assertTrue(data["ok"])

        code_missing, data_missing, _, _ = run_preflight(
            self.base_upgrade_args() + ["--plugin-scan-dir", str(self.root / "no-such-dir")],
            self.base_db_env(),
        )
        self.assertEqual(code_missing, 1)
        self.assertIn("PREFLIGHT-SCAN-DIR-MISSING", {e["code"] for e in data_missing["errors"]})

    # --- (b) release.env matches bundle (digest/version) + secret non-leakage ---

    def test_release_env_mismatches_and_security_guards_fail_closed(self):
        # Digest mismatch
        bad_digest = write_release_env(
            self.root / "config/bad-digest.env",
            [f"LIBETECH_BUILD_DIGEST={'0' * 64}", "LIBETECH_RELEASE_VERSION=0.9.8"],
        )
        args = [str(bad_digest) if a == str(self.release_env) else a for a in self.base_upgrade_args()]
        code, data, _, _ = run_preflight(args, self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-RELEASE-DIGEST-MISMATCH", {e["code"] for e in data["errors"]})

        # Version mismatch
        bad_ver = write_release_env(
            self.root / "config/bad-ver.env",
            [f'LIBETECH_BUILD_DIGEST={self.manifest["treeSha256"]}', "LIBETECH_RELEASE_VERSION=0.9.7"],
        )
        args = [str(bad_ver) if a == str(self.release_env) else a for a in self.base_upgrade_args()]
        code, data, _, _ = run_preflight(args, self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-RELEASE-VERSION-MISMATCH", {e["code"] for e in data["errors"]})

        # Plugin version mismatch
        bad_plug = write_release_env(
            self.root / "config/bad-plug.env",
            [
                f'LIBETECH_BUILD_DIGEST={self.manifest["treeSha256"]}',
                "LIBETECH_RELEASE_VERSION=0.9.8",
                "LIBETECH_PLUGIN_VERSION=0.3.2",
            ],
        )
        args = [str(bad_plug) if a == str(self.release_env) else a for a in self.base_upgrade_args()]
        code, data, _, _ = run_preflight(args, self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-RELEASE-PLUGIN-VERSION-MISMATCH", {e["code"] for e in data["errors"]})

        # World-writable release.env
        self.release_env.chmod(0o666)
        code, data, _, _ = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-RELEASE-ENV-UNSAFE", {e["code"] for e in data["errors"]})
        self.release_env.chmod(0o600)

        # Symlinked release.env
        sym_env = self.root / "config/sym.env"
        sym_env.symlink_to(self.release_env)
        args = [str(sym_env) if a == str(self.release_env) else a for a in self.base_upgrade_args()]
        code, data, _, _ = run_preflight(args, self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-RELEASE-ENV-UNSAFE", {e["code"] for e in data["errors"]})

    def test_release_env_never_leaks_secrets_even_with_malformed_lines(self):
        leaky = write_release_env(
            self.root / "config/leaky.env",
            [
                f'LIBETECH_BUILD_DIGEST={self.manifest["treeSha256"]}',
                "LIBETECH_RELEASE_VERSION=0.9.8",
                "DATABASE_URL=postgresql://admin:TOP_SECRET_PASSWORD_999@127.0.0.1:5547/db",
                "TELEGRAM_BOT_TOKEN=123456:ULTRA_SECRET_TOKEN_XYZ",
                "MALFORMED_LINE_WITH_SECRET_ABC",
            ],
        )
        args = [str(leaky) if a == str(self.release_env) else a for a in self.base_upgrade_args()]
        code, _, out, err = run_preflight(args, self.base_db_env())
        self.assertEqual(code, 1)
        combined = out + err
        for secret in ("TOP_SECRET_PASSWORD_999", "ULTRA_SECRET_TOKEN_XYZ", "MALFORMED_LINE_WITH_SECRET_ABC", "DB_SECRET_PASS_42"):
            self.assertNotIn(secret, combined)

    def test_tampered_bundle_file_fails_closed(self):
        (self.bundle / "bot-plugin/__init__.py").write_text('VERSION = "0.3.2"\n')
        code, data, _, _ = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-BUNDLE-INVALID", {e["code"] for e in data["errors"]})

    # --- (c) Migration ledger (bundle + PostgreSQL) ---

    def test_migration_ledger_passes_cleanly_and_keeps_credentials_out_of_argv(self):
        code, data, out, err = run_preflight(
            self.base_upgrade_args() + ["--expected-schema-max", "012"], self.base_db_env()
        )
        self.assertEqual(code, 0, f"stdout={out} stderr={err}")
        ledger = data["checks"]["migration_ledger"]
        self.assertEqual(ledger["applied"], [f"{i:03d}" for i in range(1, 13)])
        self.assertEqual(ledger["pending"], ["013"])
        self.assertEqual(ledger["unknown_applied"], [])
        self.assertEqual(ledger["gaps"], [])

        calls = [json.loads(line) for line in self.capture.read_text().splitlines()]
        self.assertGreaterEqual(len(calls), 2)
        for call in calls:
            self.assertNotIn("DB_SECRET_PASS_42", " ".join(call["argv"]))
            self.assertEqual(call["pg_env"].get("PGPASSWORD"), "DB_SECRET_PASS_42")
            self.assertIn("default_transaction_read_only=on", call["pg_env"].get("PGOPTIONS", ""))
            self.assertIn("BEGIN READ ONLY;", call["sql"])

    def test_migration_ledger_detects_gap_unknown_version_wrong_baseline_and_db_error(self):
        # Gap: 001..011 and 013 applied, 012 missing
        gap_psql = write_fake_psql(self.root / "psql-gap", versions=[*(f"{i:03d}" for i in range(1, 12)), "013"])
        args = [str(gap_psql) if a == str(self.fake_psql) else a for a in self.base_upgrade_args()]
        code, data, _, _ = run_preflight(args, self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-LEDGER-GAP", {e["code"] for e in data["errors"]})
        self.assertEqual(data["checks"]["migration_ledger"]["gaps"], ["012"])

        # Unknown applied version ahead of bundle (099)
        ahead_psql = write_fake_psql(self.root / "psql-ahead", versions=[*(f"{i:03d}" for i in range(1, 14)), "099"])
        args = [str(ahead_psql) if a == str(self.fake_psql) else a for a in self.base_upgrade_args()]
        code, data, _, _ = run_preflight(args, self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-LEDGER-UNKNOWN-APPLIED", {e["code"] for e in data["errors"]})

        # Unexpected baseline schema max
        code, data, _, _ = run_preflight(
            self.base_upgrade_args() + ["--expected-schema-max", "011"], self.base_db_env()
        )
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-LEDGER-UNEXPECTED-STATE", {e["code"] for e in data["errors"]})

        # Missing schema_migrations table
        no_tbl = write_fake_psql(self.root / "psql-notbl", table_exists=False)
        args = [str(no_tbl) if a == str(self.fake_psql) else a for a in self.base_upgrade_args()]
        code, data, _, _ = run_preflight(args, self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-LEDGER-TABLE-MISSING", {e["code"] for e in data["errors"]})

        # DB failure must not leak DETAIL / password
        err_psql = write_fake_psql(
            self.root / "psql-err",
            fail_stderr="ERROR: auth failed\nDETAIL: secret_row_value_xyz DB_SECRET_PASS_42\n",
        )
        args = [str(err_psql) if a == str(self.fake_psql) else a for a in self.base_upgrade_args()]
        code, data, out, err = run_preflight(args, self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-LEDGER-DB-ERROR", {e["code"] for e in data["errors"]})
        self.assertNotIn("secret_row_value_xyz", out + err)
        self.assertNotIn("DB_SECRET_PASS_42", out + err)

        # Missing DB env without --skip-db-check fails closed in upgrade mode
        code, data, _, _ = run_preflight(self.base_upgrade_args(), {})
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-LEDGER-DB-REQUIRED", {e["code"] for e in data["errors"]})

    def test_bundle_missing_rollback_or_duplicate_migration_version_fails(self):
        b2 = self.root / "bundle-no-rb"
        m2 = make_bundle(b2, migrations=[*(f"{i:03d}_m.sql" for i in range(1, 14))], rollbacks=[])
        r2 = write_release_env(
            self.root / "config/r2.env",
            [f'LIBETECH_BUILD_DIGEST={m2["treeSha256"]}', "LIBETECH_RELEASE_VERSION=0.9.8"],
        )
        args = [
            str(b2) if a == str(self.bundle) else (str(r2) if a == str(self.release_env) else a)
            for a in self.base_upgrade_args()
        ]
        code, data, _, _ = run_preflight(args, self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-MIGRATION-MISSING-ROLLBACK", {e["code"] for e in data["errors"]})

        b_gap = self.root / "bundle-gap-mig"
        m_gap = make_bundle(b_gap, migrations=["001_a.sql", "003_c.sql"], rollbacks=[])
        r_gap = write_release_env(
            self.root / "config/r-gap.env",
            [f'LIBETECH_BUILD_DIGEST={m_gap["treeSha256"]}', "LIBETECH_RELEASE_VERSION=0.9.8"],
        )
        args = [
            str(b_gap) if a == str(self.bundle) else (str(r_gap) if a == str(self.release_env) else a)
            for a in self.base_upgrade_args()
        ]
        code, data, _, _ = run_preflight(args, self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-MIGRATION-GAP", {e["code"] for e in data["errors"]})

        b3 = self.root / "bundle-dup-mig"
        m3 = make_bundle(b3, migrations=["001_a.sql", "002_first.sql", "002_second.sql"], rollbacks=[])
        r3 = write_release_env(
            self.root / "config/r3.env",
            [f'LIBETECH_BUILD_DIGEST={m3["treeSha256"]}', "LIBETECH_RELEASE_VERSION=0.9.8"],
        )
        args = [
            str(b3) if a == str(self.bundle) else (str(r3) if a == str(self.release_env) else a)
            for a in self.base_upgrade_args()
        ]
        code, data, _, _ = run_preflight(args, self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-MIGRATION-DUPLICATE", {e["code"] for e in data["errors"]})

    # --- (d) Systemd unit user & scope ---

    def test_system_unit_without_user_or_root_dropin_fails(self):
        # DELIVERY-020 P0 scenario: outbox unit installed in /etc/systemd/system without User=
        (self.system_units / "libetech-ai-os-outbox-sys.service").write_text(
            "[Unit]\nDescription=Outbox\n[Service]\nExecStart=/usr/bin/python3 /home/iptech/.hermes/x.py\n"
        )
        code, data, _, _ = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-UNIT-RUNS-AS-ROOT", {e["code"] for e in data["errors"]})
        (self.system_units / "libetech-ai-os-outbox-sys.service").unlink()

        # Drop-in override resets User= to root
        (self.system_units / "libetech-ai-os-extra.service").write_text(
            "[Service]\nUser=libetech-os\nExecStart=/bin/true\n"
        )
        dropin_dir = self.system_units / "libetech-ai-os-extra.service.d"
        dropin_dir.mkdir()
        (dropin_dir / "10-override.conf").write_text("[Service]\nUser=\n")
        code, data, _, _ = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-UNIT-RUNS-AS-ROOT", {e["code"] for e in data["errors"]})

    def test_duplicate_unit_across_scopes_and_user_unit_with_user_directive_fail(self):
        # Same unit in both system and user scope
        (self.system_units / "libetech-ai-os.service").write_text(
            "[Service]\nUser=libetech-os\nExecStart=/bin/true\n"
        )
        code, data, _, _ = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-UNIT-DUPLICATE-SCOPE", {e["code"] for e in data["errors"]})
        (self.system_units / "libetech-ai-os.service").unlink()

        # User unit setting User=
        (self.user_units / "libetech-ai-os-outbox.service").write_text(
            "[Service]\nUser=iptech\nExecStart=/usr/bin/python3 __init__.py --once\n"
        )
        code, data, _, _ = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-USER-UNIT-INVALID-DIRECTIVE", {e["code"] for e in data["errors"]})

    def test_expected_web_user_mismatch_fails(self):
        args = [
            "libetech-os" if a == "iptech" and i > 0 and self.base_upgrade_args()[i - 1] == "--expected-web-user" else a
            for i, a in enumerate(self.base_upgrade_args())
        ]
        code, data, _, _ = run_preflight(args, self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-UNIT-USER-MISMATCH", {e["code"] for e in data["errors"]})

    # --- (e) Backup dir outside scan paths ---

    def test_backup_dir_inside_or_enclosing_scan_dir_and_backup_artifacts_in_scan_dir_fail(self):
        for bad_backup, expected_code in (
            (self.scan_dir, "PREFLIGHT-BACKUP-INSIDE-SCAN-DIR"),
            (self.scan_dir / "backups", "PREFLIGHT-BACKUP-INSIDE-SCAN-DIR"),
            (self.scan_dir.parent, "PREFLIGHT-BACKUP-CONTAINS-SCAN-DIR"),
        ):
            with self.subTest(bad_backup=bad_backup):
                args = [str(bad_backup) if a == str(self.backup_dir) else a for a in self.base_upgrade_args()]
                code, data, _, _ = run_preflight(args, self.base_db_env())
                self.assertEqual(code, 1)
                self.assertIn(expected_code, {e["code"] for e in data["errors"]})

        # Symlink pointing inside scan dir
        sym_backup = self.root / "sneaky-backup-link"
        sym_backup.symlink_to(self.scan_dir)
        args = [str(sym_backup) if a == str(self.backup_dir) else a for a in self.base_upgrade_args()]
        code, data, _, _ = run_preflight(args, self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-BACKUP-INSIDE-SCAN-DIR", {e["code"] for e in data["errors"]})

        # Stray backup directory inside scan dir even without plugin.yaml
        stray = self.scan_dir / "libetech-ai-os-bridge.bak"
        stray.mkdir()
        (stray / "__init__.py").write_text("# old copy\n")
        code, data, _, _ = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-BACKUP-ARTIFACT-IN-SCAN-DIR", {e["code"] for e in data["errors"]})

    # --- Install mode (called by deploy/install-d1.sh) ---

    def test_install_mode_clean_passes_and_existing_bridge_under_any_name_fails(self):
        empty_scan = self.root / "install-scan/plugins"
        empty_scan.mkdir(parents=True)
        write_plugin(empty_scan / "libetech-priority1", name="libetech-priority1", version="1.1.4")
        empty_sys = self.root / "install-sys-units"
        empty_usr = self.root / "install-usr-units"
        empty_sys.mkdir()
        empty_usr.mkdir()

        install_args = [
            "--mode", "install",
            "--bundle", str(self.bundle),
            "--expected-digest", self.manifest["treeSha256"],
            "--plugin-scan-dir", str(empty_scan),
            "--backup-dir", str(self.backup_dir),
            "--system-unit-dir", str(empty_sys),
            "--user-unit-dir", str(empty_usr),
            "--expected-web-user", "libetech-os",
        ]
        code, data, out, err = run_preflight(install_args)
        self.assertEqual(code, 0, f"stdout={out} stderr={err}")
        self.assertTrue(data["ok"])

        # Stray renamed copy of libetech-ai-os-bridge inside scan dir blocks initial install!
        write_plugin(empty_scan / "old-bridge-copy", name="libetech-ai-os-bridge", version="0.3.2")
        code2, data2, _, _ = run_preflight(install_args)
        self.assertEqual(code2, 1)
        self.assertIn("PREFLIGHT-PLUGIN-ALREADY-EXISTS", {e["code"] for e in data2["errors"]})

    def test_install_d1_sh_invokes_preflight_isolated_and_before_mutations(self):
        text = (DEPLOY / "install-d1.sh").read_text()
        lines = [l for l in text.splitlines() if not l.lstrip().startswith("#")]
        at = lambda needle: next(i for i, l in enumerate(lines) if needle in l)

        preflight_line = at('$snap/deploy/preflight.py"')
        self.assertIn("python3 -I", lines[preflight_line])
        self.assertLess(at('tree=$(check_bundle "$snap")'), preflight_line)
        for mutation in ("apt-get", "useradd", "install -d", 'cp -a "$node_source"', "pg_createcluster", "pg_restore"):
            self.assertLess(preflight_line, at(mutation), mutation)
        self.assertIn('"deploy/preflight.py"', text, "check_bundle must require deploy/preflight.py in manifest")

    def test_internal_plugin_file_named_backup_does_not_false_positive(self):
        (self.scan_dir / "libetech-priority1/backup_helper.py").write_text("# legitimate helper\n")
        code, data, out, err = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code, 0, f"stdout={out} stderr={err}")
        self.assertTrue(data["ok"])

    def test_unreadable_dropin_fails_closed(self):
        (self.system_units / "libetech-ai-os-extra.service").write_text(
            "[Service]\nUser=libetech-os\nExecStart=/bin/true\n"
        )
        dropin_dir = self.system_units / "libetech-ai-os-extra.service.d"
        dropin_dir.mkdir()
        broken_dropin = dropin_dir / "99-broken.conf"
        broken_dropin.symlink_to(self.root / "nonexistent.conf")
        code, data, _, _ = run_preflight(self.base_upgrade_args(), self.base_db_env())
        self.assertEqual(code, 1)
        self.assertIn("PREFLIGHT-UNIT-UNREADABLE", {e["code"] for e in data["errors"]})


if __name__ == "__main__":
    unittest.main()
