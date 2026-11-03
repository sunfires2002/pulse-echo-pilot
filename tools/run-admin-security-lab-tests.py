"""TEST-only Auth diagnosis or explicitly confirmed RLS exercise. Never stores passwords."""
import argparse
import getpass
import os
from pathlib import Path
import shutil
import subprocess
import sys
from admin_lab_settings import ROOT, DEFAULT_CONFIG, read_config
from admin_password_once import checked_config
import warnings

class SafeParser(argparse.ArgumentParser):
    def error(self, message):
        self.exit(2, 'Stopped: invalid options. Values omitted.\n')

parser = SafeParser()
mode = parser.add_mutually_exclusive_group()
parser.add_argument('--config-file', type=Path, default=DEFAULT_CONFIG)
mode.add_argument('--run', action='store_true', help='Confirmed TEST Auth/RLS test using temporary fictional matches; cleans up its own rows')
mode.add_argument('--diagnose-auth', action='store_true', help='Diagnose administrator and non-administrator Auth only')
args = parser.parse_args()
try:
    config = checked_config(read_config(args.config_file))
    if not (args.run or args.diagnose_auth):
        print('Local configuration validated. NO connection/test performed. Use --diagnose-auth for Auth only, or --run for confirmed TEST match/RLS operations.')
        raise SystemExit(0)
    if not all(stream.isatty() for stream in (sys.stdin,sys.stdout,sys.stderr)):
        raise ValueError('Use an interactive Mac Terminal; never pipe credentials.')
    warnings.simplefilter('error', getpass.GetPassWarning)
    print('RLS test: temporary fictional matches will be created/updated/deleted in the pinned TEST project only.' if args.run else 'Auth diagnosis ONLY: at most one login per role, then end newly-created sessions. NO match requests.')
    if args.run and input('Confirm TEST project name: ') != 'pulse-echo-security-lab':
        raise ValueError('Project name did not match.')
    if input('Confirm by typing the TEST project ref: ').strip() != config['testProjectRef']:
        raise ValueError('Confirmation did not match.')
    if args.run and input('Type TEST_MATCH_CRUD to allow fictional match operations and cleanup: ') != 'TEST_MATCH_CRUD':
        raise ValueError('Match operation confirmation did not match.')
    admin_email = getpass.getpass('TEST administrator email (hidden): ').strip()
    admin_password = getpass.getpass('TEST administrator password (not saved): ')
    other_email = getpass.getpass('TEST non-administrator email (hidden): ').strip()
    other_password = getpass.getpass('TEST non-administrator password (not saved): ')
    if not admin_email or not other_email or admin_email == other_email:
        raise ValueError('Use two different TEST accounts.')
    env = {**os.environ, 'ADMIN_TEST_URL': config['supabaseUrl'],
           'ADMIN_TEST_KEY': config['publishableKey'], 'ADMIN_TEST_REF': config['testProjectRef'],
           'ADMIN_MATCH_WRITES_APPROVED': 'TEST_MATCH_CRUD' if args.run else '',
           'ADMIN_TEST_ADMIN_ID': config['adminUserId'],
           'ADMIN_TEST_ADMIN_EMAIL': admin_email, 'ADMIN_TEST_ADMIN_PASSWORD': admin_password,
           'ADMIN_TEST_OTHER_EMAIL': other_email, 'ADMIN_TEST_OTHER_PASSWORD': other_password}
    node = shutil.which('node') or str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
    completed = subprocess.run([node, str(ROOT / ('tests/admin-safety-rls.cjs' if args.run else 'tests/admin-auth-diagnostic.cjs'))], cwd=ROOT, env=env)
    raise SystemExit(completed.returncode)
except (Exception, KeyboardInterrupt):
    parser.exit(1, 'Stopped. Check TEST configuration, account distinction, permissions and confirmation. No values logged.\n')
