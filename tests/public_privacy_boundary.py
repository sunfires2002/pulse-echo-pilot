import sys,tempfile,unittest,json,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from public_privacy_files import ROOT,FILES,check,build
from public_privacy_config import read_config
class Boundary(unittest.TestCase):
 def test_allowlist(self):
  self.assertEqual(check(),len(FILES));out=build()
  self.assertEqual(set(str(p.relative_to(out)) for p in out.rglob('*') if p.is_file()),FILES)
  self.assertNotIn('data.js',FILES);self.assertNotIn('admin.html',FILES);self.assertNotIn('pulse-echo-workflow-backup.json',FILES)
 def test_backup_reintroduced(self):
  # Workspace-local temporary directory, never /tmp.
  import shutil
  root=ROOT/'evidence-public-privacy'/'boundary-fixture';root.mkdir(parents=True,exist_ok=True)
  try:
   (root/'pulse-echo-workflow-backup.json').write_text('{}')
   with self.assertRaisesRegex(ValueError,'Internal backup JSON'):check(root)
  finally:shutil.rmtree(root)
 def test_reject_production_or_unknown_project(self):
  folder=ROOT/'evidence-public-privacy';folder.mkdir(exist_ok=True);path=folder/'invalid-config.json'
  try:
   path.write_text(json.dumps({'supabaseUrl':'https://'+'x'*20+'.supabase.co','testProjectRef':'x'*20,'publishableKey':'sb_publishable_fake_test_key','adminUserId':'not-used'}));path.chmod(0o600)
   with self.assertRaises(ValueError):read_config(path)
  finally:path.unlink(missing_ok=True)
 def test_no_old_fallback(self):
  for name in ('index.html','match.html'):
   text=(ROOT/name).read_text()
   for marker in ('localMatches(', 'cloudMatches(', 'PULSE_MATCHES','pulse_echo_workflow_v3','src="data.js"'):self.assertNotIn(marker,text)
if __name__=='__main__':unittest.main()
