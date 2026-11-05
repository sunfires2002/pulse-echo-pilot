"""Generate LAB-only full-prepare experiment; never executes SQL."""
from pathlib import Path
from render_public_read_plan import prepare,spec
from prepare_safety import before,after
R=Path(__file__).resolve().parents[1]
def split_sql(text):
 result=[];start=i=0;quote=None
 while i<len(text):
  if quote:
   if text.startswith(quote,i):
    if quote=="'" and text.startswith("''",i): i+=2;continue
    i+=len(quote);quote=None;continue
   i+=1;continue
  if text[i]=="'":quote="'";i+=1;continue
  if text[i]=='$':
   import re
   m=re.match(r'\$[A-Za-z_0-9]*\$',text[i:])
   if m:quote=m.group();i+=len(quote);continue
  if text[i]==';':
   part=text[start:i+1].strip();start=i+1
   if part:result.append(part)
  i+=1
 assert quote is None and not text[start:].strip()
 return result
v=spec(True);full=prepare(v);b=before(v);a=after(v);assert full.startswith(b) and a in full
middle=full[len(b):full.index(a)]
statements=split_sql(middle)
assert len(statements)>10 and all('$cmd$' not in x for x in statements)
snapshot=b.split(' AS\nSELECT\n',1)[1].strip();assert snapshot.endswith(';');snapshot='SELECT\n'+snapshot[:-1]+' INTO old;'
verify=a.split(' SELECT * INTO STRICT old FROM prepare_safety_snapshot;',1)[1].split('END $verify$;',1)[0]
commands='\n'.join(' EXECUTE $cmd$'+s+'$cmd$;' for s in statements)
block="""DO $oneblock$
DECLARE old record; videos int; invalid int; public_count int; private_count int; keys text[];
BEGIN
 IF current_setting('pulse_echo.single_block_lab',true) IS DISTINCT FROM 'LAB_TEST' OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches') THEN RAISE EXCEPTION 'LAB execution guard missing'; END IF;
 LOCK TABLE public.privacy_cutover_matches IN SHARE MODE;
"""+snapshot+'\n'+commands+'\n'+verify+"\nEND $oneblock$;\n"
original=(R/'sql/public-read-cutover-rehearsal.sql').read_text();prefix=original[:original.index(b)];result=prefix+"SELECT set_config('pulse_echo.single_block_lab','LAB_TEST',true);\n"+block+"SELECT jsonb_build_object('full_prepare_passed',true,'rollback_follows',true) AS full_single_block_lab;\nROLLBACK;\n"
assert 'prepare_safety_snapshot' not in result and result.rstrip().endswith('ROLLBACK;')
(R/'sql/prepare-stage-review/lab-single-block-full-prepare.sql').write_text(result)
print('LAB-only SQL generated, statements:',len(statements))
