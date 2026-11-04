import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from audit_public_shape import audit
class Shape(unittest.TestCase):
 def row(self):
  return dict(id='sample',data_id='sample',date='2026-11-04',competition='サンプル',round=None,home='A',away='B',homeScore=1,awayScore=0,published=True,firstHalfVideo='https://youtu.be/M7lc1UVf-VE')
 def test_compatible_and_optional(self):
  r=audit([self.row()]);self.assertTrue(r['compatible']);self.assertEqual(r['counts']['videos_success'],1);self.assertEqual(r['optional_missing_or_empty']['round'],1)
 def test_incompatible_values_report_counts_not_values(self):
  row=self.row();row.update(data_id='private-id',date='2026-99-99',published='true',homeScore=-1,firstHalfVideo='private-source')
  r=audit([row]);self.assertFalse(r['compatible']);self.assertEqual(r['counts']['videos_invalid'],1);self.assertEqual(r['incompatible']['outer_inner_id_mismatch'],1);self.assertNotIn('private-source',str(r));self.assertNotIn('private-id',str(r))
 def test_excluded_display_counts(self):
  row=self.row();row.update(venue='PRIVATE',description='PRIVATE');r=audit([row]);self.assertEqual(r['counts']['nonempty_venue'],1);self.assertNotIn('PRIVATE',str(r))
if __name__=='__main__':unittest.main()
