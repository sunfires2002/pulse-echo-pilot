import unittest,sys,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from render_public_read_plan import rendered,rehearsal
class MigrationDraft(unittest.TestCase):
 def test_generated_drafts_match(self):
  for name,text in rendered().items():self.assertEqual((ROOT/'sql/production-public-read'/name).read_text(),text)
  self.assertEqual((ROOT/'sql/public-read-cutover-rehearsal.sql').read_text(),rehearsal())
 def test_production_scripts_default_to_stop(self):
  for name,text in rendered().items():
   if name == '01-prepare.sql': self.assertIn('run_prepare boolean := false',text); self.assertIn("RAISE EXCEPTION 'NOT APPROVED'",text)
   else: self.assertIn("'NOT_APPROVED'",text); self.assertIn('Production change NOT APPROVED; STOP',text)
   self.assertNotRegex(text,r'(?i)\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\.pulse_matches')
   self.assertNotIn('auth.uid',text);self.assertNotIn('CASCADE',text)
 def test_safe_stop_never_restores_original_access(self):
  text=rendered()['03-safe-stop.sql'];self.assertIn('REVOKE SELECT ON TABLE public.pulse_matches FROM PUBLIC,anon,authenticated RESTRICT',text);self.assertNotRegex(text,r'GRANT\s+SELECT');self.assertNotRegex(text,r'GRANT\s+EXECUTE')
 def test_rehearsal_is_fictional_and_rollback_only(self):
  text=rehearsal();self.assertTrue(text.rstrip().endswith('ROLLBACK;'));self.assertNotIn('COMMIT;',text)
  self.assertIn('public.privacy_cutover_matches',text);self.assertIn('existing_lab_metadata_unchanged',text)
 def test_ownership_operations_precede_membership_removal(self):
  text=rendered()['01-prepare.sql']
  self.assertLess(text.index('COMMENT ON FUNCTION'),text.index('REVOKE pulse_public_reader_v1 FROM postgres'))
  text=rendered()['03-safe-stop.sql']
  self.assertLess(text.index('GRANT pulse_public_reader_v1 TO postgres'),text.index('REVOKE EXECUTE'))
  self.assertGreater(text.index('REVOKE pulse_public_reader_v1 FROM postgres'),text.index('REVOKE EXECUTE'))
  self.assertIn('runtime_membership_restored',rehearsal())
if __name__=='__main__':unittest.main()
