-- TEST LAB ONLY. Open a separate editor, run in full; auto-releases in 40 seconds.
BEGIN;
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches') OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.privacy_cutover_matches') AND obj_description(oid,'pg_class')='PULSE fictional committed test fixture') THEN RAISE EXCEPTION 'LAB or fixture guard missing'; END IF;
END $guard$;
LOCK TABLE public.privacy_cutover_matches IN ACCESS EXCLUSIVE MODE;
SELECT pg_sleep(40);
ROLLBACK;
