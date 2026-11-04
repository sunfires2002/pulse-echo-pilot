-- READ ONLY. Run before rehearsal and after ROLLBACK; all named counts must be 0.
BEGIN READ ONLY;
WITH target AS (SELECT oid FROM pg_roles WHERE rolname='pulse_public_reader_v1'), checks AS (
 SELECT
 (SELECT count(*) FROM target) AS roles,
 (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('pulse_public_matches_v1','pulse_public_video_id_v1','pulse_public_video_audit_v1')) AS functions,
 (SELECT count(*) FROM pg_policy WHERE polrelid=to_regclass('public.pulse_matches') AND polname='pulse_public_reader_v1') AS policies,
 (SELECT count(*) FROM pg_auth_members WHERE roleid IN (SELECT oid FROM target) OR member IN (SELECT oid FROM target)) AS memberships,
 (SELECT count(*) FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE a.grantee IN (SELECT oid FROM target)) AS schema_grants,
 (SELECT count(*) FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE a.grantee IN (SELECT oid FROM target)) AS table_grants,
 (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'pg_temp_%' AND c.relname='prepare_safety_snapshot') AS visible_temp_tables,
 (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND state LIKE 'idle in transaction%' AND query ILIKE '%pulse_public_reader_v1%') AS visible_related_idle_transactions
)
SELECT to_jsonb(checks) AS name_residue_check FROM checks;
COMMIT;
