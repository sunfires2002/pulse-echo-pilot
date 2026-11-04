"""Render review-only production SQL and a rollback-only fictional LAB rehearsal.
No network, execution, secrets, or production writes. Fixed identifiers only.
"""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]

def spec(lab=False):
 return dict(table='privacy_cutover_matches' if lab else 'pulse_matches',role='pulse_privacy_cutover_reader' if lab else 'pulse_public_reader_v1',fn='privacy_cutover_public_matches_v1' if lab else 'pulse_public_matches_v1',helper='privacy_cutover_video_id_v1' if lab else 'pulse_public_video_id_v1',audit='privacy_cutover_video_audit_v1' if lab else 'pulse_public_video_audit_v1',policy='privacy_cutover_reader' if lab else 'pulse_public_reader_v1')
def prepare(v):
 t,r,f,h,a,p=(v[k] for k in ('table','role','fn','helper','audit','policy'))
 return f'''
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('public.{t}') IS NULL
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.{t}'::regclass)
 THEN RAISE EXCEPTION 'Expected RLS-enabled original table and postgres; STOP'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='{r}')
 OR to_regprocedure('public.{f}(text)') IS NOT NULL
 THEN RAISE EXCEPTION 'Candidate objects already exist; do not overwrite'; END IF;
END $$;
CREATE ROLE {r} NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
GRANT {r} TO postgres;
GRANT USAGE ON SCHEMA public TO {r};
GRANT SELECT ON TABLE public.{t} TO {r};
CREATE POLICY {p} ON public.{t} FOR SELECT TO {r}
 USING(data @> '{{"published":true}}'::jsonb);
CREATE FUNCTION public.{h}(value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = '' AS $h$
 WITH input AS (SELECT CASE WHEN jsonb_typeof(value)='string' THEN btrim(value #>> '{{}}') END v)
 SELECT CASE WHEN length(v)>2048 THEN NULL WHEN v ~ '^[A-Za-z0-9_-]{{11}}$' THEN v
 ELSE (regexp_match(v,'^https://(www\\.)?youtu\\.be/([A-Za-z0-9_-]{{11}})(\\?[^[:space:]#]*)?(#[^[:space:]]*)?$'))[2] END FROM input
$h$;
REVOKE ALL ON FUNCTION public.{h}(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.{h}(jsonb) TO {r};
CREATE FUNCTION public.{f}(requested_id text DEFAULT NULL)
RETURNS TABLE(id text,date text,competition text,round text,home text,away text,
 "homeScore" integer,"awayScore" integer,"firstHalfVideo" text,"secondHalfVideo" text,"highlightVideo" text,published boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $f$
 SELECT m.id,m.data->>'date',m.data->>'competition',m.data->>'round',m.data->>'home',m.data->>'away',
 CASE WHEN m.data->>'homeScore' ~ '^[0-9]{{1,3}}$' THEN (m.data->>'homeScore')::integer END,
 CASE WHEN m.data->>'awayScore' ~ '^[0-9]{{1,3}}$' THEN (m.data->>'awayScore')::integer END,
 public.{h}(m.data->'firstHalfVideo'),public.{h}(m.data->'secondHalfVideo'),public.{h}(m.data->'highlightVideo'),true
 FROM public.{t} m WHERE m.data @> '{{"published":true}}'::jsonb
 AND (requested_id IS NULL OR m.id=requested_id) ORDER BY m.id
$f$;
GRANT CREATE ON SCHEMA public TO {r};
ALTER FUNCTION public.{f}(text) OWNER TO {r};
REVOKE CREATE ON SCHEMA public FROM {r};
REVOKE ALL ON FUNCTION public.{f}(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.{f}(text) TO anon,authenticated;
CREATE FUNCTION public.{a}() RETURNS TABLE(video_field text,total bigint,empty bigint,converted bigint,invalid bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $a$
 WITH values_by_field AS (
 SELECT f.field,m.data->f.field value FROM public.{t} m
 CROSS JOIN (VALUES('firstHalfVideo'),('secondHalfVideo'),('highlightVideo')) f(field)
 ), classified AS (
 SELECT field,value IS NULL OR value='null'::jsonb OR (jsonb_typeof(value)='string' AND btrim(value #>> '{{}}')='') is_empty,
 public.{h}(value) video_id FROM values_by_field)
 SELECT field,count(*),count(*) FILTER(WHERE is_empty),count(*) FILTER(WHERE NOT is_empty AND video_id IS NOT NULL),
 count(*) FILTER(WHERE NOT is_empty AND video_id IS NULL) FROM classified GROUP BY field ORDER BY field
$a$;
REVOKE ALL ON FUNCTION public.{a}() FROM PUBLIC,anon,authenticated,{r};
COMMENT ON FUNCTION public.{f}(text) IS 'pulse-echo-public-read/v1 candidate';
REVOKE {r} FROM postgres;
NOTIFY pgrst,'reload schema';
'''
def cutover(v):
 t,r,f=(v[k] for k in ('table','role','fn'))
 return f'''
DO $$
DECLARE before_acl jsonb; after_acl jsonb; column_acl text; policies text; goods text;
BEGIN
 IF current_user<>'postgres' OR obj_description(to_regprocedure('public.{f}(text)'),'pg_proc') IS DISTINCT FROM 'pulse-echo-public-read/v1 candidate'
 THEN RAISE EXCEPTION 'Reviewed public RPC missing; STOP'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON p.proowner=r.oid WHERE p.oid='public.{f}(text)'::regprocedure AND r.rolname='{r}' AND NOT r.rolcanlogin AND NOT r.rolbypassrls AND p.prosecdef AND p.provolatile='s' AND p.proconfig=ARRAY['search_path=""']::text[])
 THEN RAISE EXCEPTION 'RPC role or execution configuration differs'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.{t}'::regclass)
 OR has_table_privilege('{r}','public.{t}','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES')
 OR pg_has_role('anon','{r}','MEMBER') OR pg_has_role('authenticated','{r}','MEMBER')
 THEN RAISE EXCEPTION 'RLS or read-only role isolation differs'; END IF;
 IF has_table_privilege('anon','public.{t}','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES')
 OR has_table_privilege('authenticated','public.{t}','TRUNCATE,TRIGGER,REFERENCES')
 THEN RAISE EXCEPTION 'Existing write/extra-privilege stop is not intact'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.{t}'::regclass AND polcmd<>'r')
 THEN RAISE EXCEPTION 'Unexpected write/administrator policy; review separately'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.grantor,x.grantee,x.privilege_type),'[]') INTO before_acl
 FROM (SELECT grantor,grantee,privilege_type,is_grantable FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))
 WHERE c.oid='public.{t}'::regclass AND NOT(privilege_type='SELECT' AND grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid))) x;
 SELECT md5(coalesce(string_agg(attacl::text,',' ORDER BY attnum),'')) INTO column_acl FROM pg_attribute WHERE attrelid='public.{t}'::regclass AND attnum>0 AND NOT attisdropped;
 SELECT md5(coalesce(string_agg(to_jsonb(p)::text,',' ORDER BY oid),'')) INTO policies FROM pg_policy p WHERE polrelid='public.{t}'::regclass;
 SELECT md5(coalesce((SELECT jsonb_build_object('acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity)::text FROM pg_class WHERE oid=to_regclass('public.futsal_goods')),'')) INTO goods;
 REVOKE SELECT ON TABLE public.{t} FROM PUBLIC,anon,authenticated RESTRICT;
 IF has_table_privilege('anon','public.{t}','SELECT') OR has_table_privilege('authenticated','public.{t}','SELECT')
 OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.{t}'::regclass AND a.attnum>0 AND NOT a.attisdropped AND (has_column_privilege('anon',a.attrelid,a.attnum,'SELECT') OR has_column_privilege('authenticated',a.attrelid,a.attnum,'SELECT')))
 THEN RAISE EXCEPTION 'Effective original SELECT remains; STOP'; END IF;
 IF NOT has_function_privilege('anon','public.{f}(text)','EXECUTE') OR NOT has_function_privilege('authenticated','public.{f}(text)','EXECUTE')
 THEN RAISE EXCEPTION 'Public RPC unavailable'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.grantor,x.grantee,x.privilege_type),'[]') INTO after_acl
 FROM (SELECT grantor,grantee,privilege_type,is_grantable FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) WHERE c.oid='public.{t}'::regclass) x;
 IF after_acl IS DISTINCT FROM before_acl
 OR column_acl IS DISTINCT FROM (SELECT md5(coalesce(string_agg(attacl::text,',' ORDER BY attnum),'')) FROM pg_attribute WHERE attrelid='public.{t}'::regclass AND attnum>0 AND NOT attisdropped)
 OR policies IS DISTINCT FROM (SELECT md5(coalesce(string_agg(to_jsonb(p)::text,',' ORDER BY oid),'')) FROM pg_policy p WHERE polrelid='public.{t}'::regclass)
 OR goods IS DISTINCT FROM (SELECT md5(coalesce((SELECT jsonb_build_object('acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity)::text FROM pg_class WHERE oid=to_regclass('public.futsal_goods')),'')))
 THEN RAISE EXCEPTION 'Unrelated grants/policies/columns/reactions changed; rollback'; END IF;
END $$;
'''
def stop(v):
 t,r,f=(v[k] for k in ('table','role','fn'))
 return f'''
-- Safe stop, NOT restoration of the former anonymous-read state.
-- Temporarily recover ownership authority; never keep runtime membership.
GRANT {r} TO postgres;
REVOKE EXECUTE ON FUNCTION public.{f}(text) FROM PUBLIC,anon,authenticated RESTRICT;
REVOKE SELECT ON TABLE public.{t} FROM PUBLIC,anon,authenticated RESTRICT;
DO $$ BEGIN
 IF has_table_privilege('anon','public.{t}','SELECT') OR has_table_privilege('authenticated','public.{t}','SELECT')
 OR has_function_privilege('anon','public.{f}(text)','EXECUTE') OR has_function_privilege('authenticated','public.{f}(text)','EXECUTE')
 OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.{t}'::regclass AND a.attnum>0 AND NOT a.attisdropped AND (has_column_privilege('anon',a.attrelid,a.attnum,'SELECT') OR has_column_privilege('authenticated',a.attrelid,a.attnum,'SELECT')))
 THEN RAISE EXCEPTION 'Safe stop did not close general access'; END IF;
END $$;
REVOKE {r} FROM postgres;
'''
def guard(phase):
 return f'''-- DRAFT ONLY. No production execution is authorized. Review every precondition first.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Replace this literal ONLY after separate explicit production approval.
SELECT set_config('pulse_echo.public_read_approval','NOT_APPROVED',true);
DO $$ BEGIN
 IF current_setting('pulse_echo.public_read_approval',true)<>'APPROVED_{phase}'
 THEN RAISE EXCEPTION 'Production change NOT APPROVED; STOP'; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches')
 THEN RAISE EXCEPTION 'This is the security LAB; do not apply production SQL'; END IF;
END $$;
'''
def rehearsal():
 v=spec(True);t,r,f=(v[k] for k in ('table','role','fn'))
 s='''-- SECURITY TEST PROJECT ONLY. All changes are rolled back at the end.
-- Clear any previous failed rehearsal transaction in this connection.
ROLLBACK;
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
'''+f'''
CREATE TEMP TABLE privacy_cutover_state AS SELECT
 (SELECT md5(string_agg(id||data::text||updated_at::text,',' ORDER BY id)) FROM public.{t}) data_hash,
 (SELECT md5(jsonb_build_object('acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity,'policies',
 (SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polrelid=c.oid))::text)
 FROM pg_class c WHERE oid='public.pulse_matches'::regclass) original_metadata;
'''+prepare(v)+f'''
CREATE TEMP TABLE privacy_cutover_membership_state AS SELECT
 pg_has_role('postgres','{r}','USAGE') AS inherited_access,
 coalesce((SELECT jsonb_agg(jsonb_build_object('grantor',m.grantor,'admin',m.admin_option,'inherit',to_jsonb(m)->'inherit_option','set',to_jsonb(m)->'set_option') ORDER BY m.grantor)
 FROM pg_auth_members m WHERE m.roleid='{r}'::regrole AND m.member='postgres'::regrole),'[]'::jsonb) AS membership;
'''+cutover(v)+f'''
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.{f}())<>17 OR EXISTS(SELECT 1 FROM public.{f}('public-cutover-fixture-18'))
 THEN RAISE EXCEPTION 'Public/private projection failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.{f}() x WHERE to_jsonb(x)::text LIKE '%PRIVATE_FIXTURE%')
 THEN RAISE EXCEPTION 'Internal content leaked'; END IF;
 BEGIN PERFORM * FROM public.{t}; RAISE EXCEPTION 'Anonymous original read unexpectedly accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.{f}())<>17 THEN RAISE EXCEPTION 'Authenticated RPC failed'; END IF;
 BEGIN PERFORM * FROM public.{t}; RAISE EXCEPTION 'Authenticated original accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
'''+stop(v)+f'''
DO $$ BEGIN
 IF (SELECT membership FROM privacy_cutover_membership_state) IS DISTINCT FROM
 coalesce((SELECT jsonb_agg(jsonb_build_object('grantor',m.grantor,'admin',m.admin_option,'inherit',to_jsonb(m)->'inherit_option','set',to_jsonb(m)->'set_option') ORDER BY m.grantor)
 FROM pg_auth_members m WHERE m.roleid='{r}'::regrole AND m.member='postgres'::regrole),'[]'::jsonb)
 THEN RAISE EXCEPTION 'Temporary owner membership not restored'; END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM * FROM public.{f}(); RAISE EXCEPTION 'Safe stop unexpectedly accepted RPC';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO privacy_cutover_result VALUES(jsonb_build_object(
 'cutover_passed',true,'anon_original_blocked',true,'authenticated_original_blocked',true,
 'public_only',true,'internal_fields_absent',true,'safe_stop_passed',true,'administrator_policy_added',false,
 'fictional_rows',18,'public_rows',17,'source_data_unchanged',(SELECT data_hash FROM privacy_cutover_state)=(SELECT md5(string_agg(id||data::text||updated_at::text,',' ORDER BY id)) FROM public.{t}),
 'existing_lab_metadata_unchanged',(SELECT original_metadata FROM privacy_cutover_state)=(SELECT md5(jsonb_build_object('acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity,'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polrelid=c.oid))::text) FROM pg_class c WHERE oid='public.pulse_matches'::regclass),
 'membership_metadata_restored',true,
 'runtime_membership_restored',(SELECT inherited_access FROM privacy_cutover_membership_state)=pg_has_role('postgres','{r}','USAGE'),
 'rollback_at_end',true));
SELECT result AS cutover_rehearsal FROM privacy_cutover_result;
ROLLBACK;
'''
 return s

def rendered():
 v=spec();return {'01-prepare.sql':guard('PREPARE')+prepare(v)+'COMMIT;\n','02-cutover.sql':guard('CUTOVER')+cutover(v)+'COMMIT;\n','03-safe-stop.sql':guard('SAFE_STOP')+stop(v)+'COMMIT;\n'}
if __name__=='__main__':
 target=ROOT/'sql/production-public-read';target.mkdir(parents=True,exist_ok=True)
 files={target/k:v for k,v in rendered().items()};files[ROOT/'sql/public-read-cutover-rehearsal.sql']=rehearsal()
 if sys.argv[1:]==['--write']:
  for p,value in files.items():p.write_text(value)
  print('Review-only production drafts and rollback-only LAB rehearsal rendered. No SQL executed.')
 else:
  assert all(p.read_text()==value for p,value in files.items()),'SQL draft drift'
  print('SQL drafts match the single LAB/production renderer. No SQL executed.')
