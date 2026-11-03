"""Local validation only. Never contacts Supabase or logs configuration values."""
import json
from pathlib import Path
import re
import stat
import uuid
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / '.admin-lab.private.json'
FIELDS = {'supabaseUrl', 'publishableKey', 'testProjectRef', 'adminUserId'}

def production_host():
    match = re.search(r'supabaseUrl:\s*"https://([^/\"]+)', (ROOT / 'config.js').read_text())
    if not match:
        raise ValueError('Cannot identify the blocked production host; stopped.')
    return match.group(1)

def validate(values):
    if not isinstance(values, dict) or set(values) != FIELDS:
        raise ValueError('Use only URL, publishable key, test project ref, and administrator UUID. No passwords.')
    if not all(isinstance(v, str) and v.strip() == v for v in values.values()):
        raise ValueError('Configuration fields must be strings without surrounding spaces.')
    ref = values['testProjectRef']
    if not re.fullmatch(r'[a-z0-9]{20}', ref):
        raise ValueError('Check the separate TEST project reference.')
    url = urlsplit(values['supabaseUrl'])
    if url.hostname == production_host():
        raise ValueError('Production is forbidden.')
    if (url.scheme != 'https' or url.hostname != ref + '.supabase.co'
            or url.netloc != url.hostname or url.path not in ('', '/') or url.query or url.fragment):
        raise ValueError('URL and TEST project reference must agree exactly.')
    if not re.fullmatch(r'sb_publishable_[A-Za-z0-9_-]{10,}', values['publishableKey']):
        raise ValueError('Only a publishable key is accepted; no secret/service_role keys.')
    try:
        admin_id = str(uuid.UUID(values['adminUserId']))
    except ValueError:
        raise ValueError('Use the TEST administrator Auth user UUID.') from None
    return {**values, 'supabaseUrl': 'https://' + url.hostname, 'adminUserId': admin_id}

def read_config(path=DEFAULT_CONFIG):
    path = Path(path)
    if stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise ValueError('Private configuration must be owner-only (chmod 600).')
    return validate(json.loads(path.read_text()))
