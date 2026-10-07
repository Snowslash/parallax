"""Offline checks for this source package. No installation or network access."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.parse import unquote, urlsplit

ROOT=Path(__file__).resolve().parents[1]

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def inspect(root, skip_snapshot=False):
    root=Path(root).resolve(); issues=[]
    manifest_path=root/'MANIFEST.json'
    manifest=json.loads(manifest_path.read_text())['files'] if manifest_path.exists() else {}
    if not skip_snapshot:
        if not manifest_path.exists(): issues.append('missing manifest')
        for name,expected in manifest.items():
            path=root/name
            if not path.resolve().is_relative_to(root) or path.is_symlink(): issues.append(name+': unsafe manifest path')
            elif not path.is_file() or sha(path)!=expected: issues.append(name+': hash mismatch')
    private=re.compile(r'tail[a-z0-9]+\.ts\.net|'+re.escape('/'+'home/')+r'|'+re.escape('/'+'srv/projects/')+r'|[A-Z]:\\Users\\',re.I)
    credentials=re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{32,}')
    forbidden={'.env','AGENTS.md','id_rsa','id_ed25519'}
    for p in sorted(root.rglob('*')):
        rel=p.relative_to(root); name=rel.as_posix()
        if any(part in {'.git','.venv','venv','node_modules','__pycache__'} for part in rel.parts): continue
        if p.is_symlink(): issues.append(name+': symlink');continue
        if not p.is_file(): continue
        if p.name in forbidden or p.name.startswith('.env.') or p.suffix in {'.key','.pem','.p12','.pfx'} or rel.parts[0] in {'handoff','incoming','.hermes'}:
            issues.append(name+': forbidden file');continue  # Do not read potential credential files.
        generated=(name.startswith('spikes/') and any(s in rel.parts for s in ['results','outputs']) and name not in manifest)
        if generated or p.suffix=='.log':continue
        if not skip_snapshot and name!='MANIFEST.json' and name not in manifest: issues.append(name+': unlisted file')
        raw=p.read_bytes()
        try:text=raw.decode('utf-8')
        except UnicodeDecodeError:continue
        if private.search(text):issues.append(name+': private endpoint or machine path')
        if credentials.search(text):issues.append(name+': credential pattern (value redacted)')
        if p.suffix=='.md':
            for ref in re.findall(r'\]\(([^)\s]+)\)',text):
                url=urlsplit(ref)
                if url.scheme or not url.path:continue
                target=(p.parent/unquote(url.path)).resolve()
                if not target.is_relative_to(root) or not target.exists():issues.append(name+': missing link '+url.path)
    return issues

def run(*args):
    print('\n> '+' '.join(args),flush=True)
    subprocess.run(args,cwd=ROOT,check=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--numerical',action='store_true')
    parser.add_argument('--skip-snapshot',action='store_true',help='Intentional worktree development only; not release-snapshot approval')
    args=parser.parse_args()
    issues=inspect(ROOT,args.skip_snapshot)
    if issues:
        print('\n'.join(issues));return 1
    if not shutil.which('node'):
        print('Node 22+ required for development checks. No install was attempted.');return 1
    if args.numerical:
        try:import numpy
        except ImportError:
            print('Optional NumPy missing: use your own virtual environment and requirements-numerical.txt.');return 1
    print('Snapshot/boundary checks passed. Pattern scan only, not comprehensive secret assurance.',flush=True)
    run('node','--test',*[str(p.relative_to(ROOT)) for p in sorted((ROOT/'demo/tests').glob('*.test.mjs'))])
    run('node','--test','spikes/005-mesh-projection/evidence.test.mjs')
    if args.numerical:
        for directory,pattern in [('001-projection-geometry','test_geometry.py'),('002-guided-lessons','test_*.py'),('004-3d-beam','test_*.py')]:
            run(sys.executable,'-B','-m','unittest','discover','-s','spikes/'+directory,'-p',pattern,'-v')
        run('node','spikes/005-mesh-projection/export-evidence.mjs')
        run(sys.executable,'-B','spikes/005-mesh-projection/independent_reference.py')
        run(sys.executable,'-B','-m','unittest','discover','-s','spikes/005-mesh-projection','-p','test_*.py','-v')
    print('\nPASS: requested local checks. Browser, learner and clinical validation are separate.')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
