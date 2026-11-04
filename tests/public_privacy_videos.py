import sys,json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from privacy_videos import video_id,report,public_rows,PUBLIC_FIELDS
class VideoConversion(unittest.TestCase):
 def test_supported(self):
  for value in ('M7lc1UVf-VE','https://youtu.be/M7lc1UVf-VE','https://youtu.be/M7lc1UVf-VE?si=test',' https://www.youtu.be/M7lc1UVf-VE?t=60#sample '):
   with self.subTest(value_type='supported'):self.assertEqual(video_id(value),'M7lc1UVf-VE')
 def test_invalid(self):
  for value in (None,'',42,False,{},[], 'javascript:alert(1)','http://youtu.be/M7lc1UVf-VE','https://youtu.be.evil.invalid/M7lc1UVf-VE','https://user@youtu.be/M7lc1UVf-VE','https://youtu.be:443/M7lc1UVf-VE','https://youtu.be/M7lc1UVf-VE/extra','https://youtu.be/M7lc1UVf-VE\n','https://youtu.be/invalid','https://youtu.be/M7lc1UVf-VE?'+('x'*2048)):
   with self.subTest(value_type='invalid'):self.assertIsNone(video_id(value))
 def test_invalid_not_silently_omitted(self):
  rows=[{'firstHalfVideo':'https://youtu.be/M7lc1UVf-VE','secondHalfVideo':'private.invalid','highlightVideo':42},{'firstHalfVideo':'   ','secondHalfVideo':None}]
  result=report(rows);self.assertEqual(result['invalid_total'],2);self.assertEqual(result['by_field'][0],{'video_field':'firstHalfVideo','total':2,'empty':1,'converted':1,'invalid':0});self.assertEqual(result['status'],'INVALID_VIDEO_FORMATS_REQUIRE_REVIEW');self.assertNotIn('private.invalid',json.dumps(result))
 def test_public_fields_and_source_unchanged(self):
  rows=json.loads((ROOT/'tools/privacy-fixtures.json').read_text());before=json.dumps(rows,sort_keys=True);converted=public_rows(rows)
  self.assertEqual(converted[0]['firstHalfVideo'],'M7lc1UVf-VE');self.assertEqual(converted[0]['secondHalfVideo'],'aqz-KE-bpKQ');self.assertIsNone(converted[1]['highlightVideo']);self.assertEqual(report(rows)['invalid_total'],1);self.assertEqual(json.dumps(rows,sort_keys=True),before)
  self.assertTrue(all(set(r)==set(PUBLIC_FIELDS) for r in converted));self.assertNotIn('INVALID_LAB_VIDEO_FORMAT',json.dumps(converted))
if __name__=='__main__':unittest.main()
