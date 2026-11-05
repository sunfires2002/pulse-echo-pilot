from pathlib import Path
R=Path(__file__).resolve().parents[1]
def stop(table,role,fn):
 return f'''DO $stop$
DECLARE orig_acl text; orig_rls text; orig_policies text; before_members text; reader_members text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid=to_regprocedure('public.{fn}(text)') AND r.rolname='{role}' AND p.prosecdef AND NOT r.rolcanlogin AND NOT r.rolbypassrls) THEN RAISE EXCEPTION 'Unexpected function owner or reader; STOP'; END IF;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type)::text,'')) INTO orig_acl FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.{table}'::regclass AND a.grantee<>'{role}'::regrole::oid;
 SELECT md5(jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity)::text) INTO orig_rls FROM pg_class WHERE oid='public.{table}'::regclass;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid)::text,'')) INTO orig_policies FROM pg_policy p WHERE polrelid='public.{table}'::regclass;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) INTO before_members FROM pg_auth_members m WHERE m.roleid<>'{role}'::regrole::oid AND m.member<>'{role}'::regrole::oid;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) INTO reader_members FROM pg_auth_members m WHERE m.roleid='{role}'::regrole;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='{role}'::regrole AND member='postgres'::regrole AND grantor='postgres'::regrole) THEN RAISE EXCEPTION 'Existing temporary-grant path requires review'; END IF;
 GRANT {role} TO postgres WITH SET TRUE GRANTED BY postgres;
 REVOKE EXECUTE ON FUNCTION public.{fn}(text) FROM PUBLIC,anon,authenticated RESTRICT;
 REVOKE {role} FROM postgres GRANTED BY postgres RESTRICT;
 REVOKE SELECT ON public.{table} FROM {role} RESTRICT;
 REVOKE USAGE ON SCHEMA public FROM {role} RESTRICT;
 IF has_function_privilege('anon','public.{fn}(text)','EXECUTE') OR has_function_privilege('authenticated','public.{fn}(text)','EXECUTE') OR has_table_privilege('{role}','public.{table}','SELECT') THEN RAISE EXCEPTION 'New access remains; STOP'; END IF;
 IF reader_members IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) FROM pg_auth_members m WHERE m.roleid='{role}'::regrole) THEN RAISE EXCEPTION 'Reader membership changed; STOP'; END IF;
 IF orig_acl IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type)::text,'')) FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.{table}'::regclass AND a.grantee<>'{role}'::regrole::oid)
 OR orig_rls IS DISTINCT FROM (SELECT md5(jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity)::text) FROM pg_class WHERE oid='public.{table}'::regclass)
 OR orig_policies IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid)::text,'')) FROM pg_policy p WHERE polrelid='public.{table}'::regclass)
 OR before_members IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) FROM pg_auth_members m WHERE m.roleid<>'{role}'::regrole::oid AND m.member<>'{role}'::regrole::oid)
 THEN RAISE EXCEPTION 'Existing permissions, policies or memberships changed; STOP'; END IF;
END $stop$;
'''
def guarded_stop(table,role,fn,enabled=False):
 s=stop(table,role,fn)
 s=s.replace('DECLARE orig_acl text;', 'DECLARE run_stop boolean := '+('true' if enabled else 'false')+'; orig_acl text;')
 s=s.replace("BEGIN\n IF NOT EXISTS", "BEGIN\n IF NOT run_stop THEN RAISE EXCEPTION 'NOT APPROVED'; END IF;\n PERFORM set_config('lock_timeout','5s',true);\n IF NOT EXISTS",1)
 s=s.replace('END $stop$;', "PERFORM pg_notify('pgrst','reload schema');\nEND $stop$;")
 return s
if __name__=='__main__':
 s='-- PREPARE STAGE ONLY: single-statement stop, preserves old SELECT. Separate approval required.\n'+guarded_stop('pulse_matches','pulse_public_reader_v1','pulse_public_matches_v1')
 (R/'sql/prepare-stage-review/03-prepare-safe-stop.sql').write_text(s)
