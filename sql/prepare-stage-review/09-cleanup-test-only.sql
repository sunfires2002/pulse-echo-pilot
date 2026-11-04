-- TEST PROJECT ONLY: deletes only named fictional fixtures; never run in production.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches') THEN RAISE EXCEPTION 'Security LAB marker missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.privacy_cutover_matches') AND obj_description(oid,'pg_class')='PULSE fictional committed test fixture') THEN RAISE EXCEPTION 'Fixture ownership marker missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pulse_privacy_cutover_reader' AND NOT rolcanlogin AND NOT rolbypassrls) THEN RAISE EXCEPTION 'Reader mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='pulse_privacy_cutover_reader'::regrole AND member='postgres'::regrole AND grantor='postgres'::regrole) THEN RAISE EXCEPTION 'Unexpected existing postgres grant'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.privacy_cutover_public_matches_v1(text)') AND proowner<>'pulse_privacy_cutover_reader'::regrole) THEN RAISE EXCEPTION 'Function owner mismatch'; END IF;
END $guard$;
GRANT pulse_privacy_cutover_reader TO postgres WITH SET TRUE GRANTED BY postgres;
DROP FUNCTION public.privacy_cutover_public_matches_v1(text) RESTRICT;
REVOKE pulse_privacy_cutover_reader FROM postgres GRANTED BY postgres RESTRICT;
DROP FUNCTION public.privacy_cutover_video_audit_v1() RESTRICT;
DROP FUNCTION public.privacy_cutover_video_id_v1(jsonb) RESTRICT;
DROP TABLE public.privacy_cutover_matches RESTRICT;
REVOKE USAGE ON SCHEMA public FROM pulse_privacy_cutover_reader RESTRICT;
DROP ROLE pulse_privacy_cutover_reader;
NOTIFY pgrst,'reload schema';
SELECT true AS fictional_cleanup_completed;
COMMIT;
