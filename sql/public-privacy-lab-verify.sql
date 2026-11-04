-- TEST PROJECT ONLY. Read-only catalog and function checks; no data changes.
BEGIN READ ONLY;
SELECT jsonb_build_object(
 'rls_enabled',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
 'reader_login',r.rolcanlogin,'reader_bypass_rls',r.rolbypassrls,
 'anon_original_select',has_table_privilege('anon',c.oid,'SELECT'),
 'authenticated_original_select',has_table_privilege('authenticated',c.oid,'SELECT'),
 'anon_rpc',has_function_privilege('anon','public.public_privacy_matches(text)','EXECUTE'),
 'authenticated_rpc',has_function_privilege('authenticated','public.public_privacy_matches(text)','EXECUTE'),
 'reader_write',has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE'),
 'rpc_stable',p.provolatile='s','rpc_owner_is_reader',p.proowner=r.oid,
 'rpc_fixed_search_path',p.proconfig=ARRAY['search_path=""']::text[]
) AS privacy_lab_permissions
FROM pg_class c JOIN pg_proc p ON p.oid='public.public_privacy_matches(text)'::regprocedure
JOIN pg_roles r ON r.rolname='pulse_privacy_lab_reader'
WHERE c.oid='public.privacy_lab_matches'::regclass;
SET LOCAL ROLE anon;
SELECT count(*)=2 AS public_count_correct FROM public.public_privacy_matches();
SELECT count(*)=0 AS hidden_id_blocked FROM public.public_privacy_matches('privacy-sample-hidden');
SELECT NOT EXISTS(SELECT 1 FROM public.public_privacy_matches() m WHERE to_jsonb(m)::text LIKE '%PRIVATE_FIXTURE%') AS internal_fields_absent;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT count(*)=2 AS authenticated_public_only FROM public.public_privacy_matches();
RESET ROLE;
COMMIT;
