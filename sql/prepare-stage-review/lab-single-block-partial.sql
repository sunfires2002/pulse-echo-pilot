-- TEST PROJECT ONLY: block alone must reject missing transaction guard.
DO $oneblock$
DECLARE old record; videos int; invalid int; public_count int; private_count int; keys text[];
BEGIN
 IF current_setting('pulse_echo.single_block_lab',true) IS DISTINCT FROM 'LAB_TEST' OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches') THEN RAISE EXCEPTION 'LAB execution guard missing'; END IF;
 LOCK TABLE public.privacy_cutover_matches IN SHARE MODE;
SELECT
(SELECT md5(coalesce(string_agg(id||chr(31)||updated_at::text||chr(31)||data::text,chr(30) ORDER BY id),'')) FROM public.privacy_cutover_matches) AS data_hash,
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid)::text,'')) FROM pg_policy p WHERE p.polrelid='public.privacy_cutover_matches'::regclass) AS policy_hash,
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type)::text,'')) FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.privacy_cutover_matches'::regclass) AS acl_hash,
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) FROM pg_auth_members m) AS membership_hash,
 (SELECT md5(jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity)::text) FROM pg_class WHERE oid='public.privacy_cutover_matches'::regclass) AS rls_hash INTO old;
 EXECUTE $cmd$DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('public.privacy_cutover_matches') IS NULL
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.privacy_cutover_matches'::regclass)
 THEN RAISE EXCEPTION 'Expected RLS-enabled original table and postgres; STOP'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pulse_privacy_cutover_reader')
 OR EXISTS (SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname IN ('privacy_cutover_public_matches_v1','privacy_cutover_video_id_v1','privacy_cutover_video_audit_v1'))
 OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.privacy_cutover_matches'::regclass AND polname='privacy_cutover_reader')
 THEN RAISE EXCEPTION 'Candidate objects already exist; do not overwrite'; END IF;
END $$;$cmd$;
 EXECUTE $cmd$CREATE ROLE pulse_privacy_cutover_reader NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;$cmd$;
 EXECUTE $cmd$GRANT pulse_privacy_cutover_reader TO postgres;$cmd$;
 EXECUTE $cmd$GRANT USAGE ON SCHEMA public TO pulse_privacy_cutover_reader;$cmd$;
 EXECUTE $cmd$GRANT SELECT ON TABLE public.privacy_cutover_matches TO pulse_privacy_cutover_reader;$cmd$;
 EXECUTE $cmd$CREATE POLICY privacy_cutover_reader ON public.privacy_cutover_matches FOR SELECT TO pulse_privacy_cutover_reader
 USING(data @> '{"published":true}'::jsonb);$cmd$;
 EXECUTE $cmd$CREATE FUNCTION public.privacy_cutover_video_id_v1(value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = '' AS $h$
 WITH input AS (SELECT CASE WHEN jsonb_typeof(value)='string' THEN btrim(value #>> '{}') END v)
 SELECT CASE WHEN length(v)>2048 THEN NULL WHEN v ~ '^[A-Za-z0-9_-]{11}$' THEN v
 ELSE (regexp_match(CASE WHEN v LIKE 'https://www.youtu.be/%' THEN 'https://youtu.be/' || substring(v FROM 22) ELSE v END,'^https://youtu[.]be/([A-Za-z0-9_-]{11})([?][^[:space:]#]*)?(#[^[:space:]]*)?$'))[1] END FROM input
$h$;$cmd$;
 EXECUTE $cmd$REVOKE ALL ON FUNCTION public.privacy_cutover_video_id_v1(jsonb) FROM PUBLIC,anon,authenticated;$cmd$;
 EXECUTE $cmd$GRANT EXECUTE ON FUNCTION public.privacy_cutover_video_id_v1(jsonb) TO pulse_privacy_cutover_reader;$cmd$;
 EXECUTE $cmd$CREATE FUNCTION public.privacy_cutover_public_matches_v1(requested_id text DEFAULT NULL)
RETURNS TABLE(id text,date text,competition text,round text,home text,away text,
 "homeScore" integer,"awayScore" integer,"firstHalfVideo" text,"secondHalfVideo" text,"highlightVideo" text,published boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $f$
 SELECT m.id,m.data->>'date',m.data->>'competition',m.data->>'round',m.data->>'home',m.data->>'away',
 CASE WHEN m.data->>'homeScore' ~ '^[0-9]{1,3}$' THEN (m.data->>'homeScore')::integer END,
 CASE WHEN m.data->>'awayScore' ~ '^[0-9]{1,3}$' THEN (m.data->>'awayScore')::integer END,
 public.privacy_cutover_video_id_v1(m.data->'firstHalfVideo'),public.privacy_cutover_video_id_v1(m.data->'secondHalfVideo'),public.privacy_cutover_video_id_v1(m.data->'highlightVideo'),true
 FROM public.privacy_cutover_matches m WHERE m.data @> '{"published":true}'::jsonb
 AND (requested_id IS NULL OR m.id=requested_id) ORDER BY m.id
$f$;$cmd$;
 EXECUTE $cmd$GRANT CREATE ON SCHEMA public TO pulse_privacy_cutover_reader;$cmd$;
 EXECUTE $cmd$ALTER FUNCTION public.privacy_cutover_public_matches_v1(text) OWNER TO pulse_privacy_cutover_reader;$cmd$;
 EXECUTE $cmd$REVOKE CREATE ON SCHEMA public FROM pulse_privacy_cutover_reader;$cmd$;
 EXECUTE $cmd$REVOKE ALL ON FUNCTION public.privacy_cutover_public_matches_v1(text) FROM PUBLIC,anon,authenticated;$cmd$;
 EXECUTE $cmd$GRANT EXECUTE ON FUNCTION public.privacy_cutover_public_matches_v1(text) TO anon,authenticated;$cmd$;
 EXECUTE $cmd$CREATE FUNCTION public.privacy_cutover_video_audit_v1() RETURNS TABLE(video_field text,total bigint,empty bigint,converted bigint,invalid bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $a$
 WITH values_by_field AS (
 SELECT f.field,m.data->f.field value FROM public.privacy_cutover_matches m
 CROSS JOIN (VALUES('firstHalfVideo'),('secondHalfVideo'),('highlightVideo')) f(field)
 ), classified AS (
 SELECT field,value IS NULL OR value='null'::jsonb OR (jsonb_typeof(value)='string' AND btrim(value #>> '{}')='') is_empty,
 public.privacy_cutover_video_id_v1(value) video_id FROM values_by_field)
 SELECT field,count(*),count(*) FILTER(WHERE is_empty),count(*) FILTER(WHERE NOT is_empty AND video_id IS NOT NULL),
 count(*) FILTER(WHERE NOT is_empty AND video_id IS NULL) FROM classified GROUP BY field ORDER BY field
$a$;$cmd$;
 EXECUTE $cmd$REVOKE ALL ON FUNCTION public.privacy_cutover_video_audit_v1() FROM PUBLIC,anon,authenticated,pulse_privacy_cutover_reader;$cmd$;
 EXECUTE $cmd$COMMENT ON FUNCTION public.privacy_cutover_public_matches_v1(text) IS 'pulse-echo-public-read/v1 candidate';$cmd$;
 EXECUTE $cmd$REVOKE pulse_privacy_cutover_reader FROM postgres;$cmd$;

 IF old.data_hash IS DISTINCT FROM (SELECT md5(coalesce(string_agg(id||chr(31)||updated_at::text||chr(31)||data::text,chr(30) ORDER BY id),'')) FROM public.privacy_cutover_matches)
 OR old.policy_hash IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.oid)::text,'')) FROM pg_policy q WHERE q.polrelid='public.privacy_cutover_matches'::regclass AND q.polname<>'privacy_cutover_reader')
 OR old.acl_hash IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type)::text,'')) FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.privacy_cutover_matches'::regclass AND a.grantee<>'pulse_privacy_cutover_reader'::regrole::oid)
 OR old.membership_hash IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) FROM pg_auth_members m WHERE m.roleid<>'pulse_privacy_cutover_reader'::regrole::oid AND m.member<>'pulse_privacy_cutover_reader'::regrole::oid)
 OR old.rls_hash IS DISTINCT FROM (SELECT md5(jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity)::text) FROM pg_class WHERE oid='public.privacy_cutover_matches'::regclass)
 THEN RAISE EXCEPTION 'Existing data, policies, permissions, memberships or RLS changed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='pulse_privacy_cutover_reader'::regrole::oid AND member IN ('anon'::regrole::oid,'authenticated'::regrole::oid))
 OR has_table_privilege('pulse_privacy_cutover_reader','public.privacy_cutover_matches','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN')
 THEN RAISE EXCEPTION 'Reader privileges unexpected'; END IF;
 SELECT count(*) FILTER (WHERE data @> '{"published":true}'), count(*) FILTER (WHERE data @> '{"published":false}') INTO public_count,private_count FROM public.privacy_cutover_matches;
 IF public_count<>17 OR private_count<>1 OR (SELECT count(*) FROM public.privacy_cutover_matches)<>18 THEN RAISE EXCEPTION 'Match counts differ'; END IF;
 IF (SELECT count(*) FROM public.privacy_cutover_public_matches_v1())<>public_count OR EXISTS(SELECT 1 FROM public.privacy_cutover_matches m CROSS JOIN LATERAL public.privacy_cutover_public_matches_v1(m.id) x WHERE NOT (m.data @> '{"published":true}')) THEN RAISE EXCEPTION 'Public or private projection differs'; END IF;
 SELECT array_agg(k ORDER BY k) INTO keys FROM (SELECT jsonb_object_keys(to_jsonb(x)) k FROM public.privacy_cutover_public_matches_v1() x LIMIT 12) q;
 IF keys IS DISTINCT FROM ARRAY['away','awayScore','competition','date','firstHalfVideo','highlightVideo','home','homeScore','id','published','round','secondHalfVideo']::text[] THEN RAISE EXCEPTION 'Public fields differ'; END IF;
 SELECT count(*),count(*) FILTER(WHERE public.privacy_cutover_video_id_v1(value) IS NULL) INTO videos,invalid FROM public.privacy_cutover_matches m CROSS JOIN LATERAL (VALUES(m.data->'firstHalfVideo'),(m.data->'secondHalfVideo'),(m.data->'highlightVideo')) v(value) WHERE value IS NOT NULL AND value<>'null'::jsonb AND value<>'""'::jsonb;
 IF videos<>21 OR invalid<>0 THEN RAISE EXCEPTION 'Video validation failed'; END IF;

END $oneblock$;
