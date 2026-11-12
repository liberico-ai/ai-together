import hashlib,json,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve()
manifest=json.loads((root/'deploy/BUNDLE-MANIFEST.json').read_text())
for name,expected in manifest['files'].items():
    path=root/name
    if not path.resolve().is_relative_to(root) or path.is_symlink() or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=expected:
        raise SystemExit('Bundle mismatch: '+name)
print('Bundle verified: '+manifest['treeSha256'])
