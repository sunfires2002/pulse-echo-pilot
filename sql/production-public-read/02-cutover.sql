-- DRAFT ONLY: formal cutover persists changes. Separate production approval required.
DO $cutover$
DECLARE run_cutover boolean := false; before_acl jsonb; after_acl jsonb; column_acl text; policies text; goods text;
BEGIN
 IF NOT run_cutover THEN RAISE EXCEPTION 'NOT APPROVED'; END IF;
 PERFORM set_config('lock_timeout','5s',true);
 -- The timeout must be active before this DO statement starts.
 IF NOT EXISTS (SELECT 1 FROM pg_settings WHERE name='statement_timeout' AND unit='ms' AND setting::bigint BETWEEN 1 AND 30000) THEN RAISE EXCEPTION 'STATEMENT TIMEOUT MUST BE SET BEFORE EXECUTION'; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches') THEN RAISE EXCEPTION 'Security LAB context; STOP'; END IF;
 IF current_user<>'postgres' OR obj_description(to_regprocedure('public.pulse_public_matches_v1(text)'),'pg_proc') IS DISTINCT FROM 'pulse-echo-public-read/v1 candidate'
 THEN RAISE EXCEPTION 'Reviewed public RPC missing; STOP'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON p.proowner=r.oid WHERE p.oid='public.pulse_public_matches_v1(text)'::regprocedure AND r.rolname='pulse_public_reader_v1' AND NOT r.rolcanlogin AND NOT r.rolbypassrls AND p.prosecdef AND p.provolatile='s' AND p.proconfig=ARRAY['search_path=""']::text[])
 THEN RAISE EXCEPTION 'RPC role or execution configuration differs'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.pulse_matches'::regclass)
 OR has_table_privilege('pulse_public_reader_v1','public.pulse_matches','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN')
 OR pg_has_role('anon','pulse_public_reader_v1','MEMBER') OR pg_has_role('authenticated','pulse_public_reader_v1','MEMBER')
 THEN RAISE EXCEPTION 'RLS or read-only role isolation differs'; END IF;
 IF has_table_privilege('anon','public.pulse_matches','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN')
 OR has_table_privilege('authenticated','public.pulse_matches','TRUNCATE,TRIGGER,REFERENCES,MAINTAIN')
 THEN RAISE EXCEPTION 'Existing write/extra-privilege stop is not intact'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.pulse_matches'::regclass AND polcmd<>'r')
 THEN RAISE EXCEPTION 'Unexpected write/administrator policy; review separately'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.grantor,x.grantee,x.privilege_type),'[]') INTO before_acl
 FROM (SELECT grantor,grantee,privilege_type,is_grantable FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))
 WHERE c.oid='public.pulse_matches'::regclass AND NOT(privilege_type='SELECT' AND grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid))) x;
 SELECT md5(coalesce(string_agg(attacl::text,',' ORDER BY attnum),'')) INTO column_acl FROM pg_attribute WHERE attrelid='public.pulse_matches'::regclass AND attnum>0 AND NOT attisdropped;
 SELECT md5(coalesce(string_agg(to_jsonb(p)::text,',' ORDER BY oid),'')) INTO policies FROM pg_policy p WHERE polrelid='public.pulse_matches'::regclass;
 SELECT md5(coalesce((SELECT jsonb_build_object('acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity)::text FROM pg_class WHERE oid=to_regclass('public.futsal_goods')),'')) INTO goods;
 REVOKE SELECT ON TABLE public.pulse_matches FROM PUBLIC,anon,authenticated RESTRICT;
 IF has_table_privilege('anon','public.pulse_matches','SELECT') OR has_table_privilege('authenticated','public.pulse_matches','SELECT')
 OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.pulse_matches'::regclass AND a.attnum>0 AND NOT a.attisdropped AND (has_column_privilege('anon',a.attrelid,a.attnum,'SELECT') OR has_column_privilege('authenticated',a.attrelid,a.attnum,'SELECT')))
 THEN RAISE EXCEPTION 'Effective original SELECT remains; STOP'; END IF;
 IF NOT has_function_privilege('anon','public.pulse_public_matches_v1(text)','EXECUTE') OR NOT has_function_privilege('authenticated','public.pulse_public_matches_v1(text)','EXECUTE')
 THEN RAISE EXCEPTION 'Public RPC unavailable'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.grantor,x.grantee,x.privilege_type),'[]') INTO after_acl
 FROM (SELECT grantor,grantee,privilege_type,is_grantable FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) WHERE c.oid='public.pulse_matches'::regclass) x;
 IF after_acl IS DISTINCT FROM before_acl
 OR column_acl IS DISTINCT FROM (SELECT md5(coalesce(string_agg(attacl::text,',' ORDER BY attnum),'')) FROM pg_attribute WHERE attrelid='public.pulse_matches'::regclass AND attnum>0 AND NOT attisdropped)
 OR policies IS DISTINCT FROM (SELECT md5(coalesce(string_agg(to_jsonb(p)::text,',' ORDER BY oid),'')) FROM pg_policy p WHERE polrelid='public.pulse_matches'::regclass)
 OR goods IS DISTINCT FROM (SELECT md5(coalesce((SELECT jsonb_build_object('acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity)::text FROM pg_class WHERE oid=to_regclass('public.futsal_goods')),'')))
 THEN RAISE EXCEPTION 'Unrelated grants/policies/columns/reactions changed; rollback'; END IF;
END $cutover$;
