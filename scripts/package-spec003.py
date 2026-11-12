"""Build an allowlisted source bundle for the SPEC-003 rollout."""
import hashlib
import json
import sys
import tarfile
from io import BytesIO
from pathlib import Path

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]).resolve()
version = json.loads((root / "package.json").read_text())["version"]
paths = {
    "package.json", "package-lock.json", "next.config.ts", "next-env.d.ts",
    "tsconfig.json", "vitest.config.ts", "AGENTS.md",
    "scripts/migrate.ts", "scripts/project-evidence.ts", "scripts/lbrc014-report.ts",
    "docs/LBRC014-RECONCILIATION-20261108.json", "deploy/pilot-scope.json",
}
for directory, pattern in (("src", "*"), ("migrations", "*.sql")):
    for path in (root / directory).rglob(pattern):
        if path.is_file() and not path.is_symlink() and not path.name.startswith("."):
            paths.add(path.relative_to(root).as_posix())

files = {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in sorted(paths)}
inventory = {"version": version, "files": files}
inventory["treeSha256"] = hashlib.sha256(json.dumps(files, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
prefix = "libetech-ai-os-" + version
with output.open("xb") as archive:
    with tarfile.open(fileobj=archive, mode="w:gz") as tar:
        for name in files:
            tar.add(root / name, arcname=prefix + "/" + name, recursive=False)
        data = (json.dumps(inventory, indent=2) + "\n").encode()
        entry = tarfile.TarInfo(prefix + "/SPEC003-SOURCE-MANIFEST.json")
        entry.size = len(data)
        tar.addfile(entry, BytesIO(data))

print(json.dumps({"bundle": str(output), "version": version, "files": len(files),
                  "sha256": hashlib.sha256(output.read_bytes()).hexdigest(), "treeSha256": inventory["treeSha256"]}))
