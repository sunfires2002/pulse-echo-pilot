-- TEST PROJECT ONLY. Stops only the dedicated fictional public reader.
BEGIN;
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches') OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.privacy_cutover_matches') AND obj_description(oid,'pg_class')='PULSE fictional committed test fixture') THEN RAISE EXCEPTION 'LAB or fixture guard missing'; END IF;
END $guard$;
DO $stop$
DECLARE orig_acl text; orig_rls text; orig_policies text; before_members text; reader_members text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid=to_regprocedure('public.privacy_cutover_public_matches_v1(text)') AND r.rolname='pulse_privacy_cutover_reader' AND p.prosecdef AND NOT r.rolcanlogin AND NOT r.rolbypassrls) THEN RAISE EXCEPTION 'Unexpected function owner or reader; STOP'; END IF;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type)::text,'')) INTO orig_acl FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.privacy_cutover_matches'::regclass AND a.grantee<>'pulse_privacy_cutover_reader'::regrole::oid;
 SELECT md5(jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity)::text) INTO orig_rls FROM pg_class WHERE oid='public.privacy_cutover_matches'::regclass;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid)::text,'')) INTO orig_policies FROM pg_policy p WHERE polrelid='public.privacy_cutover_matches'::regclass;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) INTO before_members FROM pg_auth_members m WHERE m.roleid<>'pulse_privacy_cutover_reader'::regrole::oid AND m.member<>'pulse_privacy_cutover_reader'::regrole::oid;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) INTO reader_members FROM pg_auth_members m WHERE m.roleid='pulse_privacy_cutover_reader'::regrole;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='pulse_privacy_cutover_reader'::regrole AND member='postgres'::regrole AND grantor='postgres'::regrole) THEN RAISE EXCEPTION 'Existing temporary-grant path requires review'; END IF;
 GRANT pulse_privacy_cutover_reader TO postgres WITH SET TRUE GRANTED BY postgres;
 REVOKE EXECUTE ON FUNCTION public.privacy_cutover_public_matches_v1(text) FROM PUBLIC,anon,authenticated RESTRICT;
 REVOKE pulse_privacy_cutover_reader FROM postgres GRANTED BY postgres RESTRICT;
 REVOKE SELECT ON public.privacy_cutover_matches FROM pulse_privacy_cutover_reader RESTRICT;
 REVOKE USAGE ON SCHEMA public FROM pulse_privacy_cutover_reader RESTRICT;
 IF has_function_privilege('anon','public.privacy_cutover_public_matches_v1(text)','EXECUTE') OR has_function_privilege('authenticated','public.privacy_cutover_public_matches_v1(text)','EXECUTE') OR has_table_privilege('pulse_privacy_cutover_reader','public.privacy_cutover_matches','SELECT') THEN RAISE EXCEPTION 'New access remains; STOP'; END IF;
 IF reader_members IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) FROM pg_auth_members m WHERE m.roleid='pulse_privacy_cutover_reader'::regrole) THEN RAISE EXCEPTION 'Reader membership changed; STOP'; END IF;
 IF orig_acl IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type)::text,'')) FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.privacy_cutover_matches'::regclass AND a.grantee<>'pulse_privacy_cutover_reader'::regrole::oid)
 OR orig_rls IS DISTINCT FROM (SELECT md5(jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity)::text) FROM pg_class WHERE oid='public.privacy_cutover_matches'::regclass)
 OR orig_policies IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid)::text,'')) FROM pg_policy p WHERE polrelid='public.privacy_cutover_matches'::regclass)
 OR before_members IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) FROM pg_auth_members m WHERE m.roleid<>'pulse_privacy_cutover_reader'::regrole::oid AND m.member<>'pulse_privacy_cutover_reader'::regrole::oid)
 THEN RAISE EXCEPTION 'Existing permissions, policies or memberships changed; STOP'; END IF;
END $stop$;

DO $verify$ BEGIN
 IF NOT has_table_privilege('anon','public.privacy_cutover_matches','SELECT') OR has_table_privilege('anon','public.privacy_cutover_matches','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN') OR has_function_privilege('anon','public.privacy_cutover_public_matches_v1(text)','EXECUTE') OR has_function_privilege('authenticated','public.privacy_cutover_public_matches_v1(text)','EXECUTE') THEN RAISE EXCEPTION 'Old access or stop conditions failed'; END IF;
END $verify$;
SELECT true AS lab_formal_safe_stop_completed;
COMMIT;
