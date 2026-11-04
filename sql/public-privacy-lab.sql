-- TEST PROJECT ONLY: pulse-echo-security-lab. Never production.
-- Existing admin-safety LAB tables, users, RLS and reaction data are untouched.
-- Run the entire file ONCE in the TEST SQL Editor as postgres.
BEGIN;
DO $$ BEGIN
 IF current_user <> 'postgres' OR NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches'
 ) OR NOT EXISTS (
  SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.pulse_matches') AND tgname='admin_lab_match_version'
 ) THEN RAISE EXCEPTION 'Separate security LAB markers missing; STOP'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pulse_privacy_lab_reader') THEN
  RAISE EXCEPTION 'LAB role already exists; inspect instead of overwriting'; END IF;
END $$;
CREATE ROLE pulse_privacy_lab_reader NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
GRANT pulse_privacy_lab_reader TO postgres;
CREATE TABLE public.privacy_lab_matches (
 id text PRIMARY KEY,
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND data->>'id'=id)
);
ALTER TABLE public.privacy_lab_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_lab_matches FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.privacy_lab_matches FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO pulse_privacy_lab_reader;
GRANT SELECT ON TABLE public.privacy_lab_matches TO pulse_privacy_lab_reader;
CREATE POLICY privacy_lab_published_only ON public.privacy_lab_matches
 FOR SELECT TO pulse_privacy_lab_reader USING(data @> '{"published":true}'::jsonb);
INSERT INTO public.privacy_lab_matches(id,data) VALUES
 ('privacy-sample-a','{"id":"privacy-sample-a","date":"2026-11-04","competition":"サンプル大会","round":"第1節","home":"サンプルA","away":"サンプルB","homeScore":2,"awayScore":1,"firstHalfVideo":"M7lc1UVf-VE","secondHalfVideo":"dQw4w9WgXcQ","highlightVideo":"","published":true,"workflow":{"memo":"PRIVATE_FIXTURE_WORKFLOW"},"filmerName":"PRIVATE_FIXTURE_PERSON","source":"https://private.invalid/PRIVATE_FIXTURE_SOURCE","memo":"PRIVATE_FIXTURE_MEMO"}'),
 ('privacy-sample-b','{"id":"privacy-sample-b","date":"2026-11-03","competition":"サンプル大会","home":"サンプルC","away":"サンプルD","homeScore":null,"awayScore":null,"published":true}'),
 ('privacy-sample-hidden','{"id":"privacy-sample-hidden","date":"2026-11-02","home":"PRIVATE_FIXTURE_HIDDEN","away":"PRIVATE_FIXTURE_HIDDEN","published":false}'),
 ('privacy-sample-missing','{"id":"privacy-sample-missing","published":"true","workflow":{"memo":"PRIVATE_FIXTURE_STRING_BOOL"}}');
CREATE FUNCTION public.public_privacy_matches(requested_id text DEFAULT NULL)
RETURNS TABLE (
 id text, date text, competition text, round text, home text, away text,
 "homeScore" integer, "awayScore" integer,
 "firstHalfVideo" text, "secondHalfVideo" text, "highlightVideo" text, published boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
 SELECT m.id,m.data->>'date',m.data->>'competition',m.data->>'round',
 m.data->>'home',m.data->>'away',
 CASE WHEN m.data->>'homeScore' ~ '^[0-9]{1,3}$' THEN (m.data->>'homeScore')::integer END,
 CASE WHEN m.data->>'awayScore' ~ '^[0-9]{1,3}$' THEN (m.data->>'awayScore')::integer END,
 CASE WHEN m.data->>'firstHalfVideo' ~ '^[A-Za-z0-9_-]{11}$' THEN m.data->>'firstHalfVideo' END,
 CASE WHEN m.data->>'secondHalfVideo' ~ '^[A-Za-z0-9_-]{11}$' THEN m.data->>'secondHalfVideo' END,
 CASE WHEN m.data->>'highlightVideo' ~ '^[A-Za-z0-9_-]{11}$' THEN m.data->>'highlightVideo' END,
 true
 FROM public.privacy_lab_matches m
 WHERE m.data @> '{"published":true}'::jsonb
 AND (requested_id IS NULL OR m.id=requested_id)
 ORDER BY m.id
$fn$;
-- Owner has SELECT only and is subject to RLS. No postgres-owned bypass function.
GRANT CREATE ON SCHEMA public TO pulse_privacy_lab_reader;
ALTER FUNCTION public.public_privacy_matches(text) OWNER TO pulse_privacy_lab_reader;
REVOKE CREATE ON SCHEMA public FROM pulse_privacy_lab_reader;
REVOKE ALL ON FUNCTION public.public_privacy_matches(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_privacy_matches(text) TO anon, authenticated;
REVOKE pulse_privacy_lab_reader FROM postgres;
COMMENT ON TABLE public.privacy_lab_matches IS 'public-information-protection-lab fictional fixtures only';
NOTIFY pgrst, 'reload schema';
COMMIT;
