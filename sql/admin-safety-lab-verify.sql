-- READ ONLY. Run only in the separate TEST project after approved setup.
-- These inspect metadata, not real-client authorization behavior.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'pulse_matches';

SELECT
  r.role_name,
  has_schema_privilege(r.role_name, 'public', 'USAGE') AS schema_usage,
  has_table_privilege(r.role_name, 'public.pulse_matches', 'SELECT') AS can_select,
  has_table_privilege(r.role_name, 'public.pulse_matches', 'INSERT') AS can_insert,
  has_table_privilege(r.role_name, 'public.pulse_matches', 'UPDATE') AS can_update,
  has_table_privilege(r.role_name, 'public.pulse_matches', 'DELETE') AS can_delete
FROM (VALUES ('anon'), ('authenticated')) r(role_name);

SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'pulse_matches'
ORDER BY policyname;

SELECT count(*) AS test_rows FROM public.pulse_matches;

SELECT tgname, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.pulse_matches'::regclass AND NOT tgisinternal;

SELECT
  has_function_privilege('anon', 'public.admin_lab_touch_match()', 'EXECUTE') AS anon_trigger_execute,
  has_function_privilege('authenticated', 'public.admin_lab_touch_match()', 'EXECUTE') AS auth_trigger_execute;
