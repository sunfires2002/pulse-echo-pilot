"""Prepare-stage invariants, shared by production draft and isolated rehearsal."""
def before(v):
 t,r=v['table'],v['role']
 return f'''
LOCK TABLE public.{t} IN SHARE MODE;
CREATE TEMP TABLE prepare_safety_snapshot ON COMMIT DROP AS
SELECT
 (SELECT md5(coalesce(string_agg(id||chr(31)||updated_at::text||chr(31)||data::text,chr(30) ORDER BY id),'')) FROM public.{t}) AS data_hash,
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid)::text,'')) FROM pg_policy p WHERE p.polrelid='public.{t}'::regclass) AS policy_hash,
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type)::text,'')) FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.{t}'::regclass) AS acl_hash,
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) FROM pg_auth_members m) AS membership_hash,
 (SELECT md5(jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity)::text) FROM pg_class WHERE oid='public.{t}'::regclass) AS rls_hash;
'''
def after(v):
 t,r,f,h,p=(v[k] for k in ('table','role','fn','helper','policy'))
 return f'''
DO $verify$
DECLARE old prepare_safety_snapshot%ROWTYPE; videos int; invalid int; public_count int; private_count int; keys text[];
BEGIN
 SELECT * INTO STRICT old FROM prepare_safety_snapshot;
 IF old.data_hash IS DISTINCT FROM (SELECT md5(coalesce(string_agg(id||chr(31)||updated_at::text||chr(31)||data::text,chr(30) ORDER BY id),'')) FROM public.{t})
 OR old.policy_hash IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.oid)::text,'')) FROM pg_policy q WHERE q.polrelid='public.{t}'::regclass AND q.polname<>'{p}')
 OR old.acl_hash IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type)::text,'')) FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.{t}'::regclass AND a.grantee<>'{r}'::regrole::oid)
 OR old.membership_hash IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) FROM pg_auth_members m WHERE m.roleid<>'{r}'::regrole::oid AND m.member<>'{r}'::regrole::oid)
 OR old.rls_hash IS DISTINCT FROM (SELECT md5(jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity)::text) FROM pg_class WHERE oid='public.{t}'::regclass)
 THEN RAISE EXCEPTION 'Existing data, policies, permissions, memberships or RLS changed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='{r}'::regrole::oid AND member IN ('anon'::regrole::oid,'authenticated'::regrole::oid))
 OR has_table_privilege('{r}','public.{t}','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN')
 THEN RAISE EXCEPTION 'Reader privileges unexpected'; END IF;
 SELECT count(*) FILTER (WHERE data @> '{{"published":true}}'), count(*) FILTER (WHERE data @> '{{"published":false}}') INTO public_count,private_count FROM public.{t};
 IF public_count<>17 OR private_count<>1 OR (SELECT count(*) FROM public.{t})<>18 THEN RAISE EXCEPTION 'Match counts differ'; END IF;
 IF (SELECT count(*) FROM public.{f}())<>public_count OR EXISTS(SELECT 1 FROM public.{t} m CROSS JOIN LATERAL public.{f}(m.id) x WHERE NOT (m.data @> '{{"published":true}}')) THEN RAISE EXCEPTION 'Public or private projection differs'; END IF;
 SELECT array_agg(k ORDER BY k) INTO keys FROM (SELECT jsonb_object_keys(to_jsonb(x)) k FROM public.{f}() x LIMIT 12) q;
 IF keys IS DISTINCT FROM ARRAY['away','awayScore','competition','date','firstHalfVideo','highlightVideo','home','homeScore','id','published','round','secondHalfVideo']::text[] THEN RAISE EXCEPTION 'Public fields differ'; END IF;
 SELECT count(*),count(*) FILTER(WHERE public.{h}(value) IS NULL) INTO videos,invalid FROM public.{t} m CROSS JOIN LATERAL (VALUES(m.data->'firstHalfVideo'),(m.data->'secondHalfVideo'),(m.data->'highlightVideo')) v(value) WHERE value IS NOT NULL AND value<>'null'::jsonb AND value<>'""'::jsonb;
 IF videos<>21 OR invalid<>0 THEN RAISE EXCEPTION 'Video validation failed'; END IF;
END $verify$;
DROP TABLE prepare_safety_snapshot;
'''
