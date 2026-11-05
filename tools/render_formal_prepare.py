"""Generate guarded formal-addition SQL from the single-statement rehearsal."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def render():
 source=(ROOT/'sql/prepare-stage-review/production-single-statement-review-only.sql').read_text()
 s=source[source.index('DO $rehearsal$'):]
 s=s.replace('$rehearsal$','$prepare$',2).replace('run_rehearsal','run_prepare')
 s=s.replace('run_prepare boolean := false; -- 実行する場合だけこの行の false を true に変更','run_prepare boolean := false; -- 正式追加を別途承認した場合のみ変更')
 old="  RAISE EXCEPTION USING ERRCODE='P9001', MESSAGE='EXPECTED_ROLLBACK';\n EXCEPTION WHEN SQLSTATE 'P9001' THEN\n  GET STACKED DIAGNOSTICS caught_message = MESSAGE_TEXT;\n  IF caught_message <> 'EXPECTED_ROLLBACK' THEN RAISE; END IF;\n  expected:=true;\n END;"
 assert s.count(old)==1;s=s.replace(old,' END;')
 start=s.index(' IF NOT expected OR EXISTS(');end=s.index('END $prepare$;',start)
 s=s[:start]+" PERFORM pg_notify('pgrst','reload schema');\n RAISE NOTICE 'PREPARE_COMPLETED';\n"+s[end:]
 s=s.replace(' expected boolean:=false; caught_message text; hidden_id text;',' hidden_id text;')
 s=s.replace(" IF NOT run_prepare THEN RAISE EXCEPTION 'NOT APPROVED'; END IF;"," IF NOT run_prepare THEN RAISE EXCEPTION 'NOT APPROVED'; END IF;\n PERFORM set_config('lock_timeout','5s',true);")
 assert 'prepare_safety_snapshot' not in s and 'EXPECTED_ROLLBACK' not in s and 'run_prepare boolean := false' in s
 return '-- FORMAL ADDITION: successful execution persists changes. NOT A ROLLBACK OR SAFE STOP. Separate approval required.\n'+s
