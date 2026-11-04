-- SECURITY TEST PROJECT ONLY. All changes are rolled back at the end.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches')
 THEN RAISE EXCEPTION 'Security LAB marker missing; STOP'; END IF;
END $$;
CREATE TEMP TABLE privacy_cutover_result(result jsonb) ON COMMIT DROP;
CREATE TABLE public.privacy_cutover_matches(id text PRIMARY KEY,updated_at timestamptz NOT NULL DEFAULT now(),data jsonb NOT NULL);
ALTER TABLE public.privacy_cutover_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.privacy_cutover_matches FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.privacy_cutover_matches TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON TABLE public.privacy_cutover_matches TO authenticated;
CREATE POLICY privacy_cutover_legacy_read ON public.privacy_cutover_matches FOR SELECT TO anon USING(true);
INSERT INTO public.privacy_cutover_matches
SELECT 'public-cutover-fixture-'||i,now(),jsonb_build_object(
'id','public-cutover-fixture-'||i,'date','2026-11-04','home','サンプルA','away','サンプルB','competition','サンプル大会',
'homeScore',1,'awayScore',0,'published',i<=17,'workflow',jsonb_build_object('memo','PRIVATE_FIXTURE_TEST'),
'firstHalfVideo',CASE WHEN i<=10 THEN 'https://youtu.be/M7lc1UVf-VE?si=fixture' ELSE '' END,
'secondHalfVideo',CASE WHEN i>=9 THEN 'https://youtu.be/aqz-KE-bpKQ?si=fixture' ELSE '' END,
'highlightVideo',CASE WHEN i=1 THEN 'https://youtu.be/M7lc1UVf-VE' ELSE '' END)
FROM generate_series(1,18) i;

CREATE TEMP TABLE privacy_cutover_state AS SELECT
 (SELECT md5(string_agg(id||data::text||updated_at::text,',' ORDER BY id)) FROM public.privacy_cutover_matches) data_hash,
 (SELECT md5(jsonb_build_object('acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity,'policies',
 (SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polrelid=c.oid))::text)
 FROM pg_class c WHERE oid='public.pulse_matches'::regclass) original_metadata;

DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('public.privacy_cutover_matches') IS NULL
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.privacy_cutover_matches'::regclass)
 THEN RAISE EXCEPTION 'Expected RLS-enabled original table and postgres; STOP'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pulse_privacy_cutover_reader')
 OR to_regprocedure('public.privacy_cutover_public_matches_v1(text)') IS NOT NULL
 THEN RAISE EXCEPTION 'Candidate objects already exist; do not overwrite'; END IF;
END $$;
CREATE ROLE pulse_privacy_cutover_reader NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
GRANT pulse_privacy_cutover_reader TO postgres;
GRANT USAGE ON SCHEMA public TO pulse_privacy_cutover_reader;
GRANT SELECT ON TABLE public.privacy_cutover_matches TO pulse_privacy_cutover_reader;
CREATE POLICY privacy_cutover_reader ON public.privacy_cutover_matches FOR SELECT TO pulse_privacy_cutover_reader
 USING(data @> '{"published":true}'::jsonb);
CREATE FUNCTION public.privacy_cutover_video_id_v1(value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = '' AS $h$
 WITH input AS (SELECT CASE WHEN jsonb_typeof(value)='string' THEN btrim(value #>> '{}') END v)
 SELECT CASE WHEN length(v)>2048 THEN NULL WHEN v ~ '^[A-Za-z0-9_-]{11}$' THEN v
 ELSE (regexp_match(v,'^https://(www\.)?youtu\.be/([A-Za-z0-9_-]{11})(\?[^[:space:]#]*)?(#[^[:space:]]*)?$'))[2] END FROM input
$h$;
REVOKE ALL ON FUNCTION public.privacy_cutover_video_id_v1(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_cutover_video_id_v1(jsonb) TO pulse_privacy_cutover_reader;
CREATE FUNCTION public.privacy_cutover_public_matches_v1(requested_id text DEFAULT NULL)
RETURNS TABLE(id text,date text,competition text,round text,home text,away text,
 "homeScore" integer,"awayScore" integer,"firstHalfVideo" text,"secondHalfVideo" text,"highlightVideo" text,published boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $f$
 SELECT m.id,m.data->>'date',m.data->>'competition',m.data->>'round',m.data->>'home',m.data->>'away',
 CASE WHEN m.data->>'homeScore' ~ '^[0-9]{1,3}$' THEN (m.data->>'homeScore')::integer END,
 CASE WHEN m.data->>'awayScore' ~ '^[0-9]{1,3}$' THEN (m.data->>'awayScore')::integer END,
 public.privacy_cutover_video_id_v1(m.data->'firstHalfVideo'),public.privacy_cutover_video_id_v1(m.data->'secondHalfVideo'),public.privacy_cutover_video_id_v1(m.data->'highlightVideo'),true
 FROM public.privacy_cutover_matches m WHERE m.data @> '{"published":true}'::jsonb
 AND (requested_id IS NULL OR m.id=requested_id) ORDER BY m.id
$f$;
GRANT CREATE ON SCHEMA public TO pulse_privacy_cutover_reader;
ALTER FUNCTION public.privacy_cutover_public_matches_v1(text) OWNER TO pulse_privacy_cutover_reader;
REVOKE CREATE ON SCHEMA public FROM pulse_privacy_cutover_reader;
REVOKE ALL ON FUNCTION public.privacy_cutover_public_matches_v1(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_cutover_public_matches_v1(text) TO anon,authenticated;
CREATE FUNCTION public.privacy_cutover_video_audit_v1() RETURNS TABLE(video_field text,total bigint,empty bigint,converted bigint,invalid bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $a$
 WITH values_by_field AS (
 SELECT f.field,m.data->f.field value FROM public.privacy_cutover_matches m
 CROSS JOIN (VALUES('firstHalfVideo'),('secondHalfVideo'),('highlightVideo')) f(field)
 ), classified AS (
 SELECT field,value IS NULL OR value='null'::jsonb OR (jsonb_typeof(value)='string' AND btrim(value #>> '{}')='') is_empty,
 public.privacy_cutover_video_id_v1(value) video_id FROM values_by_field)
 SELECT field,count(*),count(*) FILTER(WHERE is_empty),count(*) FILTER(WHERE NOT is_empty AND video_id IS NOT NULL),
 count(*) FILTER(WHERE NOT is_empty AND video_id IS NULL) FROM classified GROUP BY field ORDER BY field
$a$;
REVOKE ALL ON FUNCTION public.privacy_cutover_video_audit_v1() FROM PUBLIC,anon,authenticated,pulse_privacy_cutover_reader;
REVOKE pulse_privacy_cutover_reader FROM postgres;
COMMENT ON FUNCTION public.privacy_cutover_public_matches_v1(text) IS 'pulse-echo-public-read/v1 candidate';
NOTIFY pgrst,'reload schema';

DO $$
DECLARE before_acl jsonb; after_acl jsonb; column_acl text; policies text; goods text;
BEGIN
 IF current_user<>'postgres' OR obj_description(to_regprocedure('public.privacy_cutover_public_matches_v1(text)'),'pg_proc') IS DISTINCT FROM 'pulse-echo-public-read/v1 candidate'
 THEN RAISE EXCEPTION 'Reviewed public RPC missing; STOP'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON p.proowner=r.oid WHERE p.oid='public.privacy_cutover_public_matches_v1(text)'::regprocedure AND r.rolname='pulse_privacy_cutover_reader' AND NOT r.rolcanlogin AND NOT r.rolbypassrls AND p.prosecdef AND p.provolatile='s' AND p.proconfig=ARRAY['search_path=""']::text[])
 THEN RAISE EXCEPTION 'RPC role or execution configuration differs'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.privacy_cutover_matches'::regclass)
 OR has_table_privilege('pulse_privacy_cutover_reader','public.privacy_cutover_matches','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES')
 OR pg_has_role('anon','pulse_privacy_cutover_reader','MEMBER') OR pg_has_role('authenticated','pulse_privacy_cutover_reader','MEMBER')
 THEN RAISE EXCEPTION 'RLS or read-only role isolation differs'; END IF;
 IF has_table_privilege('anon','public.privacy_cutover_matches','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES')
 OR has_table_privilege('authenticated','public.privacy_cutover_matches','TRUNCATE,TRIGGER,REFERENCES')
 THEN RAISE EXCEPTION 'Existing write/extra-privilege stop is not intact'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.privacy_cutover_matches'::regclass AND polcmd<>'r')
 THEN RAISE EXCEPTION 'Unexpected write/administrator policy; review separately'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.grantor,x.grantee,x.privilege_type),'[]') INTO before_acl
 FROM (SELECT grantor,grantee,privilege_type,is_grantable FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))
 WHERE c.oid='public.privacy_cutover_matches'::regclass AND NOT(privilege_type='SELECT' AND grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid))) x;
 SELECT md5(coalesce(string_agg(attacl::text,',' ORDER BY attnum),'')) INTO column_acl FROM pg_attribute WHERE attrelid='public.privacy_cutover_matches'::regclass AND attnum>0 AND NOT attisdropped;
 SELECT md5(coalesce(string_agg(to_jsonb(p)::text,',' ORDER BY oid),'')) INTO policies FROM pg_policy p WHERE polrelid='public.privacy_cutover_matches'::regclass;
 SELECT md5(coalesce((SELECT jsonb_build_object('acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity)::text FROM pg_class WHERE oid=to_regclass('public.futsal_goods')),'')) INTO goods;
 REVOKE SELECT ON TABLE public.privacy_cutover_matches FROM PUBLIC,anon,authenticated RESTRICT;
 IF has_table_privilege('anon','public.privacy_cutover_matches','SELECT') OR has_table_privilege('authenticated','public.privacy_cutover_matches','SELECT')
 OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.privacy_cutover_matches'::regclass AND a.attnum>0 AND NOT a.attisdropped AND (has_column_privilege('anon',a.attrelid,a.attnum,'SELECT') OR has_column_privilege('authenticated',a.attrelid,a.attnum,'SELECT')))
 THEN RAISE EXCEPTION 'Effective original SELECT remains; STOP'; END IF;
 IF NOT has_function_privilege('anon','public.privacy_cutover_public_matches_v1(text)','EXECUTE') OR NOT has_function_privilege('authenticated','public.privacy_cutover_public_matches_v1(text)','EXECUTE')
 THEN RAISE EXCEPTION 'Public RPC unavailable'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.grantor,x.grantee,x.privilege_type),'[]') INTO after_acl
 FROM (SELECT grantor,grantee,privilege_type,is_grantable FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) WHERE c.oid='public.privacy_cutover_matches'::regclass) x;
 IF after_acl IS DISTINCT FROM before_acl
 OR column_acl IS DISTINCT FROM (SELECT md5(coalesce(string_agg(attacl::text,',' ORDER BY attnum),'')) FROM pg_attribute WHERE attrelid='public.privacy_cutover_matches'::regclass AND attnum>0 AND NOT attisdropped)
 OR policies IS DISTINCT FROM (SELECT md5(coalesce(string_agg(to_jsonb(p)::text,',' ORDER BY oid),'')) FROM pg_policy p WHERE polrelid='public.privacy_cutover_matches'::regclass)
 OR goods IS DISTINCT FROM (SELECT md5(coalesce((SELECT jsonb_build_object('acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity)::text FROM pg_class WHERE oid=to_regclass('public.futsal_goods')),'')))
 THEN RAISE EXCEPTION 'Unrelated grants/policies/columns/reactions changed; rollback'; END IF;
END $$;

SET LOCAL ROLE anon;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.privacy_cutover_public_matches_v1())<>17 OR EXISTS(SELECT 1 FROM public.privacy_cutover_public_matches_v1('public-cutover-fixture-18'))
 THEN RAISE EXCEPTION 'Public/private projection failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.privacy_cutover_public_matches_v1() x WHERE to_jsonb(x)::text LIKE '%PRIVATE_FIXTURE%')
 THEN RAISE EXCEPTION 'Internal content leaked'; END IF;
 BEGIN PERFORM * FROM public.privacy_cutover_matches; RAISE EXCEPTION 'Anonymous original read unexpectedly accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.privacy_cutover_public_matches_v1())<>17 THEN RAISE EXCEPTION 'Authenticated RPC failed'; END IF;
 BEGIN PERFORM * FROM public.privacy_cutover_matches; RAISE EXCEPTION 'Authenticated original accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

-- Safe stop, NOT restoration of the former anonymous-read state.
REVOKE EXECUTE ON FUNCTION public.privacy_cutover_public_matches_v1(text) FROM PUBLIC,anon,authenticated RESTRICT;
REVOKE SELECT ON TABLE public.privacy_cutover_matches FROM PUBLIC,anon,authenticated RESTRICT;
DO $$ BEGIN
 IF has_table_privilege('anon','public.privacy_cutover_matches','SELECT') OR has_table_privilege('authenticated','public.privacy_cutover_matches','SELECT')
 OR has_function_privilege('anon','public.privacy_cutover_public_matches_v1(text)','EXECUTE') OR has_function_privilege('authenticated','public.privacy_cutover_public_matches_v1(text)','EXECUTE')
 OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.privacy_cutover_matches'::regclass AND a.attnum>0 AND NOT a.attisdropped AND (has_column_privilege('anon',a.attrelid,a.attnum,'SELECT') OR has_column_privilege('authenticated',a.attrelid,a.attnum,'SELECT')))
 THEN RAISE EXCEPTION 'Safe stop did not close general access'; END IF;
END $$;

SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM * FROM public.privacy_cutover_public_matches_v1(); RAISE EXCEPTION 'Safe stop unexpectedly accepted RPC';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO privacy_cutover_result VALUES(jsonb_build_object(
 'cutover_passed',true,'anon_original_blocked',true,'authenticated_original_blocked',true,
 'public_only',true,'internal_fields_absent',true,'safe_stop_passed',true,'administrator_policy_added',false,
 'fictional_rows',18,'public_rows',17,'source_data_unchanged',(SELECT data_hash FROM privacy_cutover_state)=(SELECT md5(string_agg(id||data::text||updated_at::text,',' ORDER BY id)) FROM public.privacy_cutover_matches),
 'existing_lab_metadata_unchanged',(SELECT original_metadata FROM privacy_cutover_state)=(SELECT md5(jsonb_build_object('acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity,'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polrelid=c.oid))::text) FROM pg_class c WHERE oid='public.pulse_matches'::regclass),
 'rollback_at_end',true));
SELECT result AS cutover_rehearsal FROM privacy_cutover_result;
ROLLBACK;
