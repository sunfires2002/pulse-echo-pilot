"""Prompt locally; create an ignored owner-only file. Makes NO network requests."""
import argparse
import getpass
import json
import os
from pathlib import Path
import subprocess
import sys
from admin_lab_settings import ROOT, DEFAULT_CONFIG, validate

parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=DEFAULT_CONFIG)
args = parser.parse_args()
path = args.output.absolute()
try:
    if not sys.stdin.isatty():
        raise ValueError('Use an interactive Mac Terminal; never pipe credentials.')
    if path.exists():
        raise ValueError('Configuration already exists. Do not overwrite it silently.')
    if path == ROOT or ROOT in path.parents:
        name = str(path.relative_to(ROOT))
        tracked = subprocess.run(['git', 'ls-files', '--error-unmatch', '--', name], cwd=ROOT,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ignored = subprocess.run(['git', 'check-ignore', '-q', '--', name], cwd=ROOT)
        if tracked.returncode == 0 or ignored.returncode != 0:
            raise ValueError('The output file must be untracked and Git-ignored.')
    values = validate({
        'supabaseUrl': input('TEST Supabase URL: ').strip(),
        'testProjectRef': input('TEST project ref: ').strip(),
        'publishableKey': getpass.getpass('TEST publishable key (hidden): ').strip(),
        'adminUserId': getpass.getpass('TEST administrator UUID (hidden): ').strip()
    })
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as file:
        json.dump(values, file, indent=2)
        file.write('\n')
    print('Owner-only local configuration saved. No connection or authentication was attempted.')
except (ValueError, OSError):
    parser.exit(1, 'Stopped. Check the separate-project fields, file permissions and ignored output path. No values logged.\n')
