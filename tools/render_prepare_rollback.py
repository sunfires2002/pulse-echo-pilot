"""Build guarded production dry-run and fixture-only rehearsal; no DB access."""
from pathlib import Path
from render_public_read_plan import spec,prepare,guard
R=Path(__file__).resolve().parents[1]
def preview(v):
 t,f=v['table'],v['fn']
 return f'''\nSET LOCAL ROLE authenticated;
DO $test$ BEGIN
 IF (SELECT count(*) FROM public.{f}())<>17 THEN RAISE EXCEPTION 'authenticated public count mismatch'; END IF;
 IF NOT has_table_privilege('authenticated','public.{t}','SELECT') THEN RAISE EXCEPTION 'Old authenticated SELECT missing'; END IF;
 IF has_table_privilege('anon','public.{t}','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN') OR has_table_privilege('authenticated','public.{t}','TRUNCATE,TRIGGER,REFERENCES,MAINTAIN') THEN RAISE EXCEPTION 'Unexpected privilege'; END IF;
END $test$;
RESET ROLE;
SELECT jsonb_build_object('public_rows',17,'authenticated_role_checked',true,'rollback_follows',true) AS prepare_rollback_preview;
ROLLBACK;
'''
def build():
 prod=guard('PREPARE')+prepare(spec())+preview(spec())
 lab=(R/'sql/public-read-cutover-rehearsal.sql').read_text();marker="NOTIFY pgrst,'reload schema';";lab=lab[:lab.index(marker)+len(marker)]+preview(spec(True))
 return {'production-prepare-rollback.sql':prod,'lab-prepare-rollback.sql':lab}
if __name__=='__main__':
 for n,s in build().items(): (R/'sql/prepare-stage-review'/n).write_text(s)
 print('Generated review files; no SQL executed.')
