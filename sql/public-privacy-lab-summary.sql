-- TEST PROJECT ONLY. Single read-only result, no row contents or credentials.
BEGIN READ ONLY;
SELECT jsonb_build_object(
 'rls_enabled',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
 'reader_no_login',NOT r.rolcanlogin,'reader_no_bypass',NOT r.rolbypassrls,
 'anon_original_blocked',NOT has_table_privilege('anon',c.oid,'SELECT'),
 'authenticated_original_blocked',NOT has_table_privilege('authenticated',c.oid,'SELECT'),
 'anon_rpc_allowed',has_function_privilege('anon',p.oid,'EXECUTE'),
 'authenticated_rpc_allowed',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'reader_no_write',NOT has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE'),
 'anon_no_write',NOT has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE'),
 'authenticated_no_write',NOT has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE'),
 'reader_not_client_member',NOT pg_has_role('anon',r.oid,'MEMBER') AND NOT pg_has_role('authenticated',r.oid,'MEMBER'),
 'rpc_stable',p.provolatile='s','rpc_owner_is_reader',p.proowner=r.oid,
 'rpc_fixed_search_path',p.proconfig=ARRAY['search_path=""']::text[],
 'public_count_correct',(SELECT count(*)=2 FROM public.public_privacy_matches()),
 'private_id_hidden',NOT EXISTS(SELECT 1 FROM public.public_privacy_matches('privacy-sample-hidden')),
 'internal_fields_absent',NOT EXISTS(SELECT 1 FROM public.public_privacy_matches() m WHERE to_jsonb(m)::text LIKE '%PRIVATE_FIXTURE%')
) AS privacy_lab_summary
FROM pg_class c JOIN pg_proc p ON p.oid='public.public_privacy_matches(text)'::regprocedure
JOIN pg_roles r ON r.rolname='pulse_privacy_lab_reader'
WHERE c.oid='public.privacy_lab_matches'::regclass;
COMMIT;
