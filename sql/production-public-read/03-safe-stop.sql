-- DRAFT ONLY. No production execution is authorized. Review every precondition first.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Replace this literal ONLY after separate explicit production approval.
SELECT set_config('pulse_echo.public_read_approval','NOT_APPROVED',true);
DO $$ BEGIN
 IF current_setting('pulse_echo.public_read_approval',true)<>'APPROVED_SAFE_STOP'
 THEN RAISE EXCEPTION 'Production change NOT APPROVED; STOP'; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches')
 THEN RAISE EXCEPTION 'This is the security LAB; do not apply production SQL'; END IF;
END $$;

-- Safe stop, NOT restoration of the former anonymous-read state.
REVOKE EXECUTE ON FUNCTION public.pulse_public_matches_v1(text) FROM PUBLIC,anon,authenticated RESTRICT;
REVOKE SELECT ON TABLE public.pulse_matches FROM PUBLIC,anon,authenticated RESTRICT;
DO $$ BEGIN
 IF has_table_privilege('anon','public.pulse_matches','SELECT') OR has_table_privilege('authenticated','public.pulse_matches','SELECT')
 OR has_function_privilege('anon','public.pulse_public_matches_v1(text)','EXECUTE') OR has_function_privilege('authenticated','public.pulse_public_matches_v1(text)','EXECUTE')
 OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.pulse_matches'::regclass AND a.attnum>0 AND NOT a.attisdropped AND (has_column_privilege('anon',a.attrelid,a.attnum,'SELECT') OR has_column_privilege('authenticated',a.attrelid,a.attnum,'SELECT')))
 THEN RAISE EXCEPTION 'Safe stop did not close general access'; END IF;
END $$;
COMMIT;
