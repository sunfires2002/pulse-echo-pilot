"""TEST Auth diagnosis only. Match mutation tests are paused. Never stores passwords."""
import argparse
import getpass
import os
from pathlib import Path
import shutil
import subprocess
import sys
from admin_lab_settings import ROOT, DEFAULT_CONFIG, read_config

parser = argparse.ArgumentParser()
parser.add_argument('--config-file', type=Path, default=DEFAULT_CONFIG)
parser.add_argument('--run', action='store_true', help='Compatibility alias for Auth diagnosis ONLY; no match tests')
parser.add_argument('--diagnose-auth', action='store_true', help='Diagnose administrator and non-administrator Auth only')
args = parser.parse_args()
try:
    config = read_config(args.config_file)
    if not (args.run or args.diagnose_auth):
        print('Local configuration validated. NO connection/test performed. Use --diagnose-auth for Auth-only diagnosis.')
        raise SystemExit(0)
    if not sys.stdin.isatty():
        raise ValueError('Use an interactive Mac Terminal; never pipe credentials.')
    print('Auth diagnosis ONLY: at most one login per role, then end newly-created sessions. NO match requests.')
    if input('Confirm by typing the TEST project ref: ').strip() != config['testProjectRef']:
        raise ValueError('Confirmation did not match.')
    admin_email = getpass.getpass('TEST administrator email (hidden): ').strip()
    admin_password = getpass.getpass('TEST administrator password (not saved): ')
    other_email = getpass.getpass('TEST non-administrator email (hidden): ').strip()
    other_password = getpass.getpass('TEST non-administrator password (not saved): ')
    if not admin_email or not other_email or admin_email == other_email:
        raise ValueError('Use two different TEST accounts.')
    env = {**os.environ, 'ADMIN_TEST_URL': config['supabaseUrl'],
           'ADMIN_TEST_KEY': config['publishableKey'],
           'ADMIN_TEST_ADMIN_ID': config['adminUserId'],
           'ADMIN_TEST_ADMIN_EMAIL': admin_email, 'ADMIN_TEST_ADMIN_PASSWORD': admin_password,
           'ADMIN_TEST_OTHER_EMAIL': other_email, 'ADMIN_TEST_OTHER_PASSWORD': other_password}
    node = shutil.which('node') or str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
    completed = subprocess.run([node, str(ROOT / 'tests/admin-auth-diagnostic.cjs')], cwd=ROOT, env=env)
    raise SystemExit(completed.returncode)
except (ValueError, OSError):
    parser.exit(1, 'Stopped. Check TEST configuration, account distinction, permissions and confirmation. No values logged.\n')
