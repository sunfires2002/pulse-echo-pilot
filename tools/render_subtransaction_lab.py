"""LAB-only exception rollback experiment; never executes SQL."""
from pathlib import Path
from render_single_block_lab import split_sql
R=Path(__file__).resolve().parents[1];folder=R/'sql/prepare-stage-review'
s=(folder/'lab-single-block-full-prepare.sql').read_text()
fixture=s[s.index('CREATE TABLE public.privacy_cutover_matches'):s.index('FROM generate_series(1,18) i;')+len('FROM generate_series(1,18) i;')]
block=s[s.index('DO $oneblock$'):s.index('END $oneblock$;')+len('END $oneblock$;')]
commands='\n'.join('  EXECUTE $fixture$'+x+'$fixture$;' for x in split_sql(fixture))
common="""-- TEST PROJECT ONLY: execute the entire single DO statement; no production access.
DO $experiment$
DECLARE initial_data text; initial_meta text; initial_members text; expected boolean:=false; caught_message text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches') THEN RAISE EXCEPTION 'Security LAB marker missing'; END IF;
 IF to_regclass('public.privacy_cutover_matches') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pulse_privacy_cutover_reader') THEN RAISE EXCEPTION 'Fixture collision'; END IF;
 SELECT md5(coalesce(string_agg(id||chr(31)||updated_at::text||chr(31)||data::text,chr(30) ORDER BY id),'')) INTO initial_data FROM public.pulse_matches;
 SELECT md5(jsonb_build_object('acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity,'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid=c.oid))::text) INTO initial_meta FROM pg_class c WHERE oid='public.pulse_matches'::regclass;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) INTO initial_members FROM pg_auth_members m;
 BEGIN
"""+commands+"\n  PERFORM set_config('pulse_echo.single_block_lab','LAB_TEST',true);\n  EXECUTE $nested$"+block+"$nested$;\n  RAISE EXCEPTION USING ERRCODE='P9001', MESSAGE='EXPECTED_ROLLBACK';\n EXCEPTION WHEN SQLSTATE 'P9001' THEN GET STACKED DIAGNOSTICS caught_message = MESSAGE_TEXT; IF caught_message <> 'EXPECTED_ROLLBACK' THEN RAISE; END IF; expected:=true;\n END;\n"
end=""" IF NOT expected OR to_regclass('public.privacy_cutover_matches') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pulse_privacy_cutover_reader') OR to_regprocedure('public.privacy_cutover_public_matches_v1(text)') IS NOT NULL THEN RAISE EXCEPTION 'Rollback verification failed'; END IF;
 IF initial_data IS DISTINCT FROM (SELECT md5(coalesce(string_agg(id||chr(31)||updated_at::text||chr(31)||data::text,chr(30) ORDER BY id),'')) FROM public.pulse_matches)
 OR initial_meta IS DISTINCT FROM (SELECT md5(jsonb_build_object('acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity,'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid=c.oid))::text) FROM pg_class c WHERE oid='public.pulse_matches'::regclass)
 OR initial_members IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) FROM pg_auth_members m) THEN RAISE EXCEPTION 'Existing LAB state changed'; END IF;
 RAISE NOTICE 'SUBTRANSACTION_TEST_PASSED';
END $experiment$;
"""
(folder/'lab-forced-subtransaction-normal.sql').write_text(common+end)
(folder/'lab-forced-subtransaction-error.sql').write_text((common+end).replace("  RAISE EXCEPTION USING ERRCODE='P9001'", "  RAISE EXCEPTION 'INTENTIONAL_SUBTRANSACTION_FAILURE';\n  RAISE EXCEPTION USING ERRCODE='P9001'"))
print('LAB-only single-statement tests generated')
