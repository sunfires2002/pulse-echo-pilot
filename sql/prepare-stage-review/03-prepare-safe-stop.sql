-- PREPARE STAGE ONLY: single-statement stop, preserves old SELECT. Separate approval required.
DO $stop$
DECLARE run_stop boolean := false; orig_acl text; orig_rls text; orig_policies text; before_members text; reader_members text;
BEGIN
 IF NOT run_stop THEN RAISE EXCEPTION 'NOT APPROVED'; END IF;
 PERFORM set_config('lock_timeout','5s',true);
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid=to_regprocedure('public.pulse_public_matches_v1(text)') AND r.rolname='pulse_public_reader_v1' AND p.prosecdef AND NOT r.rolcanlogin AND NOT r.rolbypassrls) THEN RAISE EXCEPTION 'Unexpected function owner or reader; STOP'; END IF;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type)::text,'')) INTO orig_acl FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.pulse_matches'::regclass AND a.grantee<>'pulse_public_reader_v1'::regrole::oid;
 SELECT md5(jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity)::text) INTO orig_rls FROM pg_class WHERE oid='public.pulse_matches'::regclass;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid)::text,'')) INTO orig_policies FROM pg_policy p WHERE polrelid='public.pulse_matches'::regclass;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) INTO before_members FROM pg_auth_members m WHERE m.roleid<>'pulse_public_reader_v1'::regrole::oid AND m.member<>'pulse_public_reader_v1'::regrole::oid;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) INTO reader_members FROM pg_auth_members m WHERE m.roleid='pulse_public_reader_v1'::regrole;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='pulse_public_reader_v1'::regrole AND member='postgres'::regrole AND grantor='postgres'::regrole) THEN RAISE EXCEPTION 'Existing temporary-grant path requires review'; END IF;
 GRANT pulse_public_reader_v1 TO postgres WITH SET TRUE GRANTED BY postgres;
 REVOKE EXECUTE ON FUNCTION public.pulse_public_matches_v1(text) FROM PUBLIC,anon,authenticated RESTRICT;
 REVOKE pulse_public_reader_v1 FROM postgres GRANTED BY postgres RESTRICT;
 REVOKE SELECT ON public.pulse_matches FROM pulse_public_reader_v1 RESTRICT;
 REVOKE USAGE ON SCHEMA public FROM pulse_public_reader_v1 RESTRICT;
 IF has_function_privilege('anon','public.pulse_public_matches_v1(text)','EXECUTE') OR has_function_privilege('authenticated','public.pulse_public_matches_v1(text)','EXECUTE') OR has_table_privilege('pulse_public_reader_v1','public.pulse_matches','SELECT') THEN RAISE EXCEPTION 'New access remains; STOP'; END IF;
 IF reader_members IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) FROM pg_auth_members m WHERE m.roleid='pulse_public_reader_v1'::regrole) THEN RAISE EXCEPTION 'Reader membership changed; STOP'; END IF;
 IF orig_acl IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type)::text,'')) FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.pulse_matches'::regclass AND a.grantee<>'pulse_public_reader_v1'::regrole::oid)
 OR orig_rls IS DISTINCT FROM (SELECT md5(jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity)::text) FROM pg_class WHERE oid='public.pulse_matches'::regclass)
 OR orig_policies IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid)::text,'')) FROM pg_policy p WHERE polrelid='public.pulse_matches'::regclass)
 OR before_members IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) FROM pg_auth_members m WHERE m.roleid<>'pulse_public_reader_v1'::regrole::oid AND m.member<>'pulse_public_reader_v1'::regrole::oid)
 THEN RAISE EXCEPTION 'Existing permissions, policies or memberships changed; STOP'; END IF;
PERFORM pg_notify('pgrst','reload schema');
END $stop$;
