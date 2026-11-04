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

LOCK TABLE public.pulse_matches IN SHARE MODE;
CREATE TEMP TABLE prepare_safety_snapshot ON COMMIT DROP AS
SELECT
 (SELECT md5(coalesce(string_agg(id||chr(31)||updated_at::text||chr(31)||data::text,chr(30) ORDER BY id),'')) FROM public.pulse_matches) AS data_hash,
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid)::text,'')) FROM pg_policy p WHERE p.polrelid='public.pulse_matches'::regclass) AS policy_hash,
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type)::text,'')) FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.pulse_matches'::regclass) AS acl_hash,
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) FROM pg_auth_members m) AS membership_hash,
 (SELECT md5(jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity)::text) FROM pg_class WHERE oid='public.pulse_matches'::regclass) AS rls_hash;

DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('public.pulse_matches') IS NULL
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.pulse_matches'::regclass)
 THEN RAISE EXCEPTION 'Expected RLS-enabled original table and postgres; STOP'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pulse_public_reader_v1')
 OR EXISTS (SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname IN ('pulse_public_matches_v1','pulse_public_video_id_v1','pulse_public_video_audit_v1'))
 OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.pulse_matches'::regclass AND polname='pulse_public_reader_v1')
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
 ELSE (regexp_match(CASE WHEN v LIKE 'https://www.youtu.be/%' THEN 'https://youtu.be/' || substring(v FROM 22) ELSE v END,'^https://youtu[.]be/([A-Za-z0-9_-]{11})([?][^[:space:]#]*)?(#[^[:space:]]*)?$'))[1] END FROM input
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
COMMENT ON FUNCTION public.pulse_public_matches_v1(text) IS 'pulse-echo-public-read/v1 candidate';
REVOKE pulse_public_reader_v1 FROM postgres;

DO $verify$
DECLARE old prepare_safety_snapshot%ROWTYPE; videos int; invalid int; public_count int; private_count int; keys text[];
BEGIN
 SELECT * INTO STRICT old FROM prepare_safety_snapshot;
 IF old.data_hash IS DISTINCT FROM (SELECT md5(coalesce(string_agg(id||chr(31)||updated_at::text||chr(31)||data::text,chr(30) ORDER BY id),'')) FROM public.pulse_matches)
 OR old.policy_hash IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.oid)::text,'')) FROM pg_policy q WHERE q.polrelid='public.pulse_matches'::regclass AND q.polname<>'pulse_public_reader_v1')
 OR old.acl_hash IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type)::text,'')) FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.pulse_matches'::regclass AND a.grantee<>'pulse_public_reader_v1'::regrole::oid)
 OR old.membership_hash IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) FROM pg_auth_members m WHERE m.roleid<>'pulse_public_reader_v1'::regrole::oid AND m.member<>'pulse_public_reader_v1'::regrole::oid)
 OR old.rls_hash IS DISTINCT FROM (SELECT md5(jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity)::text) FROM pg_class WHERE oid='public.pulse_matches'::regclass)
 THEN RAISE EXCEPTION 'Existing data, policies, permissions, memberships or RLS changed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='pulse_public_reader_v1'::regrole::oid AND member IN ('anon'::regrole::oid,'authenticated'::regrole::oid))
 OR has_table_privilege('pulse_public_reader_v1','public.pulse_matches','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN')
 THEN RAISE EXCEPTION 'Reader privileges unexpected'; END IF;
 SELECT count(*) FILTER (WHERE data @> '{"published":true}'), count(*) FILTER (WHERE data @> '{"published":false}') INTO public_count,private_count FROM public.pulse_matches;
 IF public_count<>17 OR private_count<>1 OR (SELECT count(*) FROM public.pulse_matches)<>18 THEN RAISE EXCEPTION 'Match counts differ'; END IF;
 IF (SELECT count(*) FROM public.pulse_public_matches_v1())<>public_count OR EXISTS(SELECT 1 FROM public.pulse_matches m CROSS JOIN LATERAL public.pulse_public_matches_v1(m.id) x WHERE NOT (m.data @> '{"published":true}')) THEN RAISE EXCEPTION 'Public or private projection differs'; END IF;
 SELECT array_agg(k ORDER BY k) INTO keys FROM (SELECT jsonb_object_keys(to_jsonb(x)) k FROM public.pulse_public_matches_v1() x LIMIT 12) q;
 IF keys IS DISTINCT FROM ARRAY['away','awayScore','competition','date','firstHalfVideo','highlightVideo','home','homeScore','id','published','round','secondHalfVideo']::text[] THEN RAISE EXCEPTION 'Public fields differ'; END IF;
 SELECT count(*),count(*) FILTER(WHERE public.pulse_public_video_id_v1(value) IS NULL) INTO videos,invalid FROM public.pulse_matches m CROSS JOIN LATERAL (VALUES(m.data->'firstHalfVideo'),(m.data->'secondHalfVideo'),(m.data->'highlightVideo')) v(value) WHERE value IS NOT NULL AND value<>'null'::jsonb AND value<>'""'::jsonb;
 IF videos<>21 OR invalid<>0 THEN RAISE EXCEPTION 'Video validation failed'; END IF;
END $verify$;
DROP TABLE prepare_safety_snapshot;
NOTIFY pgrst,'reload schema';

SET LOCAL ROLE authenticated;
DO $test$ BEGIN
 IF (SELECT count(*) FROM public.pulse_public_matches_v1())<>17 THEN RAISE EXCEPTION 'authenticated public count mismatch'; END IF;
 IF NOT has_table_privilege('authenticated','public.pulse_matches','SELECT') THEN RAISE EXCEPTION 'Old authenticated SELECT missing'; END IF;
 IF has_table_privilege('anon','public.pulse_matches','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN') OR has_table_privilege('authenticated','public.pulse_matches','TRUNCATE,TRIGGER,REFERENCES,MAINTAIN') THEN RAISE EXCEPTION 'Unexpected privilege'; END IF;
END $test$;
RESET ROLE;
SELECT jsonb_build_object('public_rows',17,'authenticated_role_checked',true,'rollback_follows',true) AS prepare_rollback_preview;
ROLLBACK;
