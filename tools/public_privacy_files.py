"""Explicit public artifact boundary. No deploy operation is provided."""
from pathlib import Path
import re
import shutil
ROOT=Path(__file__).resolve().parents[1]
FILES=frozenset('''index.html match.html config.js public-matches.js public-load.css style.css feature-icons.css feature-icons.svg profile.js profile-dialog.js profile-dialog.css home-profile.js pc-desktop.js pc-video-controls.js pc-voice-diagnostics.js pc-voice.js pc-base.css tv-view.css pc-lab.css tv-view.js pc-lab.js assets/pulse-echo-icon.png'''.split())
FORBIDDEN=('PRIVATE_FIXTURE_', 'service_role', 'sb_secret_', 'BEGIN PRIVATE KEY', 'pulse_echo_workflow_v3', 'window.PULSE_MATCHES')
def check(root=ROOT):
    # A returned backup must fail CI, even though it would not be copied.
    for path in root.rglob('*.json'):
        if any(part in ('.git','dist-public','evidence-public-privacy') for part in path.relative_to(root).parts): continue
        if 'backup' in path.name.lower() or 'workflow' in path.name.lower():
            raise ValueError('Internal backup JSON found; public build refused')
    for name in FILES:
        path=root/name
        if not path.is_file() or path.is_symlink(): raise ValueError('Public file missing or symlink rejected')
        if path.suffix in ('.html','.js','.css','.svg'):
            content=path.read_text()
            if any(marker in content for marker in FORBIDDEN): raise ValueError('Internal content in public artifact')
    for name in ('index.html','match.html'):
        html=(root/name).read_text()
        if re.search(r'<script[^>]+src=["\']data\.js',html) or 'localMatches(' in html or 'cloudMatches(' in html:
            raise ValueError('Unsafe match fallback returned')
    if not re.fullmatch(r'/\*[^*]*\*/\s*window\.PULSE_CONFIG=Object\.freeze\(\{\}\);\s*', (root/'config.js').read_text()):
        raise ValueError('Public artifact must keep disconnected LAB configuration')
    return len(FILES)
def build():
    check()
    out=ROOT/'dist-public'
    if out.exists(): shutil.rmtree(out)
    for name in FILES:
        target=out/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,target)
    if set(str(p.relative_to(out)) for p in out.rglob('*') if p.is_file())!=FILES: raise ValueError('Artifact not allowlisted')
    return out
if __name__=='__main__':
    import sys
    if sys.argv[1:]==['--build']: print('Allowlisted LAB artifact created:',build())
    else: print('Public boundary check passed:',check(),'files')
