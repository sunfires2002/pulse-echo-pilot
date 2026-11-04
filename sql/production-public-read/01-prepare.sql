-- DRAFT ONLY. No production execution is authorized. Review every precondition first.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Replace this literal ONLY after separate explicit production approval.
SELECT set_config('pulse_echo.public_read_approval','NOT_APPROVED',true);
DO $$ BEGIN
 IF current_setting('pulse_echo.public_read_approval',true)<>'APPROVED_PREPARE'
 THEN RAISE EXCEPTION 'Production change NOT APPROVED; STOP'; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches')
 THEN RAISE EXCEPTION 'This is the security LAB; do not apply production SQL'; END IF;
END $$;

DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('public.pulse_matches') IS NULL
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.pulse_matches'::regclass)
 THEN RAISE EXCEPTION 'Expected RLS-enabled original table and postgres; STOP'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pulse_public_reader_v1')
 OR to_regprocedure('public.pulse_public_matches_v1(text)') IS NOT NULL
 THEN RAISE EXCEPTION 'Candidate objects already exist; do not overwrite'; END IF;
END $$;
CREATE ROLE pulse_public_reader_v1 NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
GRANT pulse_public_reader_v1 TO postgres;
GRANT USAGE ON SCHEMA public TO pulse_public_reader_v1;
GRANT SELECT ON TABLE public.pulse_matches TO pulse_public_reader_v1;
CREATE POLICY pulse_public_reader_v1 ON public.pulse_matches FOR SELECT TO pulse_public_reader_v1
 USING(data @> '{"published":true}'::jsonb);
CREATE FUNCTION public.pulse_public_video_id_v1(value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = '' AS $h$
 WITH input AS (SELECT CASE WHEN jsonb_typeof(value)='string' THEN btrim(value #>> '{}') END v)
 SELECT CASE WHEN length(v)>2048 THEN NULL WHEN v ~ '^[A-Za-z0-9_-]{11}$' THEN v
 ELSE (regexp_match(v,'^https://(www\.)?youtu\.be/([A-Za-z0-9_-]{11})(\?[^[:space:]#]*)?(#[^[:space:]]*)?$'))[2] END FROM input
$h$;
REVOKE ALL ON FUNCTION public.pulse_public_video_id_v1(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_public_video_id_v1(jsonb) TO pulse_public_reader_v1;
CREATE FUNCTION public.pulse_public_matches_v1(requested_id text DEFAULT NULL)
RETURNS TABLE(id text,date text,competition text,round text,home text,away text,
 "homeScore" integer,"awayScore" integer,"firstHalfVideo" text,"secondHalfVideo" text,"highlightVideo" text,published boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $f$
 SELECT m.id,m.data->>'date',m.data->>'competition',m.data->>'round',m.data->>'home',m.data->>'away',
 CASE WHEN m.data->>'homeScore' ~ '^[0-9]{1,3}$' THEN (m.data->>'homeScore')::integer END,
 CASE WHEN m.data->>'awayScore' ~ '^[0-9]{1,3}$' THEN (m.data->>'awayScore')::integer END,
 public.pulse_public_video_id_v1(m.data->'firstHalfVideo'),public.pulse_public_video_id_v1(m.data->'secondHalfVideo'),public.pulse_public_video_id_v1(m.data->'highlightVideo'),true
 FROM public.pulse_matches m WHERE m.data @> '{"published":true}'::jsonb
 AND (requested_id IS NULL OR m.id=requested_id) ORDER BY m.id
$f$;
GRANT CREATE ON SCHEMA public TO pulse_public_reader_v1;
ALTER FUNCTION public.pulse_public_matches_v1(text) OWNER TO pulse_public_reader_v1;
REVOKE CREATE ON SCHEMA public FROM pulse_public_reader_v1;
REVOKE ALL ON FUNCTION public.pulse_public_matches_v1(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_public_matches_v1(text) TO anon,authenticated;
CREATE FUNCTION public.pulse_public_video_audit_v1() RETURNS TABLE(video_field text,total bigint,empty bigint,converted bigint,invalid bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $a$
 WITH values_by_field AS (
 SELECT f.field,m.data->f.field value FROM public.pulse_matches m
 CROSS JOIN (VALUES('firstHalfVideo'),('secondHalfVideo'),('highlightVideo')) f(field)
 ), classified AS (
 SELECT field,value IS NULL OR value='null'::jsonb OR (jsonb_typeof(value)='string' AND btrim(value #>> '{}')='') is_empty,
 public.pulse_public_video_id_v1(value) video_id FROM values_by_field)
 SELECT field,count(*),count(*) FILTER(WHERE is_empty),count(*) FILTER(WHERE NOT is_empty AND video_id IS NOT NULL),
 count(*) FILTER(WHERE NOT is_empty AND video_id IS NULL) FROM classified GROUP BY field ORDER BY field
$a$;
REVOKE ALL ON FUNCTION public.pulse_public_video_audit_v1() FROM PUBLIC,anon,authenticated,pulse_public_reader_v1;
REVOKE pulse_public_reader_v1 FROM postgres;
COMMENT ON FUNCTION public.pulse_public_matches_v1(text) IS 'pulse-echo-public-read/v1 candidate';
NOTIFY pgrst,'reload schema';
COMMIT;
