from pathlib import Path
from render_prepare_stage import stop
R=Path(__file__).resolve().parents[1]
s=(R/'sql/public-read-cutover-rehearsal.sql').read_text(); marker="NOTIFY pgrst,'reload schema';"; pos=s.index(marker)+len(marker)
setup=s[:pos]
end="""
DO $$ BEGIN
 IF NOT has_table_privilege('anon','public.privacy_cutover_matches','SELECT') THEN RAISE EXCEPTION 'Original public read interrupted'; END IF;
 IF has_function_privilege('anon','public.privacy_cutover_public_matches_v1(text)','EXECUTE') THEN RAISE EXCEPTION 'New function still callable'; END IF;
END $$;
SELECT jsonb_build_object('original_access_preserved',true,'new_access_stopped',true,'rollback_follows',true) AS prepare_stop_rehearsal;
ROLLBACK;
"""
base=stop('privacy_cutover_matches','pulse_privacy_cutover_reader','privacy_cutover_public_matches_v1')
(R/'sql/prepare-stage-review/04-stop-rehearsal.sql').write_text(setup+'\n'+base+end)
(R/'sql/prepare-stage-review/05-stop-failure.sql').write_text(setup+'\n'+base+"DO $$ BEGIN RAISE EXCEPTION 'INTENTIONAL_PREPARE_STOP_FAILURE'; END $$;\nROLLBACK;\n")
