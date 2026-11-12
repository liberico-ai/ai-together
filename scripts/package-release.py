"""Package the reviewed source tree without runtime state or team documents."""
from pathlib import Path
import datetime,hashlib,io,json,tarfile
root=Path(__file__).resolve().parents[1]
version=json.loads((root/'package.json').read_text())['version']
excluded={'node_modules','.runtime','.data','.next','.git','__pycache__','coverage'}
files=[]
for dirname in ['src','migrations','scripts','deploy','bot-plugin','tests','data']:
    for path in (root/dirname).rglob('*'):
        if not path.is_file() or path.is_symlink() or any(part in excluded for part in path.relative_to(root).parts):continue
        if path.name in {'BUNDLE-MANIFEST.json','SOURCE-MANIFEST.json'} or path.suffix in {'.pyc','.dump'}:continue
        files.append(path)
for name in ['package.json','package-lock.json','next.config.ts','tsconfig.json','next-env.d.ts','vitest.config.ts','AGENTS.md','README.md','.gitignore']:
    if (root/name).is_file():files.append(root/name)
files.append(root/'docs/LBRC014-RECONCILIATION-20261108.json')
hashes={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}
manifest={'version':version,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'kind':'source-tree-digest-not-git-commit','treeSha256':hashlib.sha256(json.dumps(hashes,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'files':hashes}
out=Path(f'/private/tmp/libetech-ai-os-{version}-20261111.tar.gz')
with tarfile.open(out,'w:gz') as tar:
    for name in hashes:tar.add(root/name,arcname=f'libetech-ai-os-{version}/'+name,recursive=False)
    manifest_bytes=(json.dumps(manifest,indent=2)+'\n').encode()
    for name in ['docs/SOURCE-MANIFEST.json','deploy/BUNDLE-MANIFEST.json']:
        info=tarfile.TarInfo(f'libetech-ai-os-{version}/{name}')
        info.size=len(manifest_bytes);info.mode=0o600
        tar.addfile(info,io.BytesIO(manifest_bytes))
print(json.dumps({'archive':str(out),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'sourceTree':manifest['treeSha256'],'fileCount':len(hashes)}))
