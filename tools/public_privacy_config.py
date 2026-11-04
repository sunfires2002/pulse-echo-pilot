"""TEST-only configuration reader. Never outputs configuration values."""
import hashlib,json,re,stat
from pathlib import Path
PIN='808bf65cd5d0a599e7a0470d1670c128bd5e2a6445ef5111d5c9994de1f5ac35'
def read_config(path):
    path=Path(path)
    if stat.S_IMODE(path.stat().st_mode)&0o077: raise ValueError('Owner-only TEST configuration required')
    v=json.loads(path.read_text())
    if set(v)!={'supabaseUrl','publishableKey','testProjectRef','adminUserId'}: raise ValueError('Unexpected configuration fields')
    if not all(isinstance(x,str) for x in v.values()): raise ValueError('Invalid TEST configuration')
    ref=v['testProjectRef']
    if not re.fullmatch('[a-z0-9]{20}',ref) or hashlib.sha256(ref.encode()).hexdigest()!=PIN or v['supabaseUrl'].rstrip('/')!='https://'+ref+'.supabase.co': raise ValueError('Only the pinned security TEST project is allowed')
    if not re.fullmatch(r'sb_publishable_[A-Za-z0-9_-]{10,}',v['publishableKey']): raise ValueError('Publishable key only; secret/JWT keys forbidden')
    return {'publicApiUrl':v['supabaseUrl'].rstrip('/'),'publicApiKey':v['publishableKey'],'publicMatchesRpc':'public_privacy_matches'}
