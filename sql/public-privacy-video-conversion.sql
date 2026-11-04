-- SEPARATE TEST PROJECT ONLY: pulse-echo-security-lab.
-- Updates this privacy LAB's functions and three fictional video fields only.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres'
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches')
 OR obj_description(to_regclass('public.privacy_lab_matches'),'pg_class') IS DISTINCT FROM 'public-information-protection-lab fictional fixtures only'
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pulse_privacy_lab_reader' AND NOT rolcanlogin AND NOT rolbypassrls)
 THEN RAISE EXCEPTION 'Separate privacy LAB markers missing; STOP'; END IF;
END $$;
GRANT pulse_privacy_lab_reader TO postgres;
CREATE FUNCTION public.privacy_lab_youtube_id(value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = ''
AS $convert$
 WITH input AS (
  SELECT CASE WHEN jsonb_typeof(value)='string' THEN btrim(value #>> '{}') END AS v
 )
 SELECT CASE
 WHEN length(v)>2048 THEN NULL
 WHEN v ~ '^[A-Za-z0-9_-]{11}$' THEN v
 ELSE (regexp_match(v,'^https://(www\.)?youtu\.be/([A-Za-z0-9_-]{11})(\?[^[:space:]#]*)?(#[^[:space:]]*)?$'))[2]
 END FROM input
$convert$;
REVOKE ALL ON FUNCTION public.privacy_lab_youtube_id(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_lab_youtube_id(jsonb) TO pulse_privacy_lab_reader;
CREATE OR REPLACE FUNCTION public.public_privacy_matches(requested_id text DEFAULT NULL)
RETURNS TABLE (
 id text,date text,competition text,round text,home text,away text,
 "homeScore" integer,"awayScore" integer,"firstHalfVideo" text,"secondHalfVideo" text,"highlightVideo" text,published boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
 SELECT m.id,m.data->>'date',m.data->>'competition',m.data->>'round',m.data->>'home',m.data->>'away',
 CASE WHEN m.data->>'homeScore' ~ '^[0-9]{1,3}$' THEN (m.data->>'homeScore')::integer END,
 CASE WHEN m.data->>'awayScore' ~ '^[0-9]{1,3}$' THEN (m.data->>'awayScore')::integer END,
 public.privacy_lab_youtube_id(m.data->'firstHalfVideo'),
 public.privacy_lab_youtube_id(m.data->'secondHalfVideo'),
 public.privacy_lab_youtube_id(m.data->'highlightVideo'),true
 FROM public.privacy_lab_matches m
 WHERE m.data @> '{"published":true}'::jsonb
 AND (requested_id IS NULL OR m.id=requested_id)
 ORDER BY m.id
$fn$;
REVOKE ALL ON FUNCTION public.public_privacy_matches(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.public_privacy_matches(text) TO anon,authenticated;
-- Counts only. SQL Editor administrator only; no anon/authenticated EXECUTE.
-- No row identifiers, video IDs, URLs, names, or internal JSON are returned.
CREATE FUNCTION public.privacy_lab_video_audit()
RETURNS TABLE(video_field text,total bigint,empty bigint,converted bigint,invalid bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $audit$
 WITH values_by_field AS (
  SELECT f.field,m.data->f.field AS value
  FROM public.privacy_lab_matches m
  CROSS JOIN (VALUES('firstHalfVideo'),('secondHalfVideo'),('highlightVideo')) f(field)
 ), classified AS (
  SELECT field,
   value IS NULL OR value='null'::jsonb OR
   (jsonb_typeof(value)='string' AND btrim(value #>> '{}')='') AS is_empty,
   public.privacy_lab_youtube_id(value) AS video_id
  FROM values_by_field
 )
 SELECT field,count(*),count(*) FILTER(WHERE is_empty),
 count(*) FILTER(WHERE NOT is_empty AND video_id IS NOT NULL),
 count(*) FILTER(WHERE NOT is_empty AND video_id IS NULL)
 FROM classified GROUP BY field ORDER BY field
$audit$;
REVOKE ALL ON FUNCTION public.privacy_lab_video_audit() FROM PUBLIC,anon,authenticated,pulse_privacy_lab_reader;
-- Only LAB fixtures, never the existing admin-safety table or production data.
UPDATE public.privacy_lab_matches
 SET data=jsonb_set(jsonb_set(data,'{firstHalfVideo}',to_jsonb('https://youtu.be/M7lc1UVf-VE?si=privacy-lab'::text)),
 '{secondHalfVideo}',to_jsonb('https://youtu.be/aqz-KE-bpKQ?si=privacy-lab'::text))
 WHERE id='privacy-sample-a';
UPDATE public.privacy_lab_matches
 SET data=jsonb_set(data,'{highlightVideo}',to_jsonb('INVALID_LAB_VIDEO_FORMAT'::text))
 WHERE id='privacy-sample-b';
REVOKE pulse_privacy_lab_reader FROM postgres;
NOTIFY pgrst,'reload schema';
COMMIT;
-- One safe administrator-visible result. The invalid fixture MUST be counted.
SELECT jsonb_build_object(
 'by_field',(SELECT jsonb_agg(to_jsonb(a)) FROM public.privacy_lab_video_audit() a),
 'invalid_total',(SELECT sum(invalid) FROM public.privacy_lab_video_audit()),
 'status',CASE WHEN EXISTS(SELECT 1 FROM public.privacy_lab_video_audit() WHERE invalid>0)
   THEN 'INVALID_VIDEO_FORMATS_REQUIRE_REVIEW' ELSE 'OK' END
) AS administrator_video_report;
