-- TEST PROJECT pulse-echo-security-lab ONLY. Read-only, no cleanup or privilege change.
BEGIN READ ONLY;
WITH counts AS (
 SELECT
 (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='privacy_cutover_matches') tables_remaining,
 (SELECT count(*) FROM pg_roles WHERE rolname='pulse_privacy_cutover_reader') roles_remaining,
 (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('privacy_cutover_public_matches_v1','privacy_cutover_video_id_v1','privacy_cutover_video_audit_v1')) functions_remaining,
 (SELECT count(*) FROM pg_policy WHERE polname IN ('privacy_cutover_legacy_read','privacy_cutover_reader')) policies_remaining,
 (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'pg_temp_%' AND c.relname IN ('privacy_cutover_result','privacy_cutover_state','privacy_cutover_membership_state')) temp_tables_remaining,
 (SELECT count(*) FROM pg_auth_members m WHERE m.roleid IN (SELECT oid FROM pg_roles WHERE rolname='pulse_privacy_cutover_reader') OR m.member IN (SELECT oid FROM pg_roles WHERE rolname='pulse_privacy_cutover_reader')) memberships_remaining,
 (SELECT count(*) FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE a.grantee IN (SELECT oid FROM pg_roles WHERE rolname='pulse_privacy_cutover_reader')) schema_grants_remaining,
 (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND state LIKE 'idle in transaction%' AND (query ILIKE '%privacy_cutover%' OR query ILIKE '%pulse_privacy_cutover_reader%')) visible_related_idle_transactions
)
SELECT jsonb_build_object(
 'counts',to_jsonb(c),
 'all_target_objects_removed',tables_remaining=0 AND roles_remaining=0 AND functions_remaining=0 AND policies_remaining=0 AND temp_tables_remaining=0 AND memberships_remaining=0 AND schema_grants_remaining=0,
 'existing_admin_lab_table_preserved',to_regclass('public.pulse_matches') IS NOT NULL,
 'existing_privacy_lab_table_preserved',to_regclass('public.privacy_lab_matches') IS NOT NULL,
 'existing_privacy_rpc_preserved',to_regprocedure('public.public_privacy_matches(text)') IS NOT NULL,
 'other_sessions_not_globally_proven',true
) AS lab_residue_audit FROM counts c;
COMMIT;
