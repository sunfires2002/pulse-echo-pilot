-- Optional TEST-only cleanup of THIS experiment. Does not restore anonymous original access.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches')
 OR obj_description(to_regclass('public.privacy_lab_matches'),'pg_class') IS DISTINCT FROM 'public-information-protection-lab fictional fixtures only'
 THEN RAISE EXCEPTION 'LAB markers missing; STOP'; END IF;
END $$;
DROP FUNCTION public.public_privacy_matches(text) RESTRICT;
DROP FUNCTION IF EXISTS public.privacy_lab_video_audit() RESTRICT;
DROP FUNCTION IF EXISTS public.privacy_lab_youtube_id(jsonb) RESTRICT;
DROP TABLE public.privacy_lab_matches RESTRICT;
REVOKE USAGE ON SCHEMA public FROM pulse_privacy_lab_reader;
DROP ROLE pulse_privacy_lab_reader;
NOTIFY pgrst,'reload schema';
COMMIT;
