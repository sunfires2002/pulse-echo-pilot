-- LAB ONLY: isolated prototype. No temporary tables; transaction always rolls back.
BEGIN;
SELECT set_config('pulse_echo.lab_single_block','LAB_ROLLBACK_ONLY',true);
DO $prototype$
DECLARE original_data text; original_rls boolean; rejected boolean := false;
BEGIN
 IF current_setting('pulse_echo.lab_single_block',true) IS DISTINCT FROM 'LAB_ROLLBACK_ONLY' OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches') THEN RAISE EXCEPTION 'LAB guard missing'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pulse_single_block_probe') OR to_regprocedure('public.pulse_single_block_probe()') IS NOT NULL THEN RAISE EXCEPTION 'Test name already exists'; END IF;
 SELECT md5(coalesce(string_agg(id||chr(31)||updated_at::text||chr(31)||data::text,chr(30) ORDER BY id),'')) INTO original_data FROM public.pulse_matches;
 SELECT relrowsecurity INTO original_rls FROM pg_class WHERE oid='public.pulse_matches'::regclass;
 CREATE ROLE pulse_single_block_probe NOLOGIN NOSUPERUSER NOBYPASSRLS;
 CREATE FUNCTION public.pulse_single_block_probe() RETURNS integer LANGUAGE sql AS 'SELECT 1';
 IF original_data IS DISTINCT FROM (SELECT md5(coalesce(string_agg(id||chr(31)||updated_at::text||chr(31)||data::text,chr(30) ORDER BY id),'')) FROM public.pulse_matches) OR original_rls IS DISTINCT FROM (SELECT relrowsecurity FROM pg_class WHERE oid='public.pulse_matches'::regclass) THEN RAISE EXCEPTION 'Existing data or RLS changed'; END IF;
 BEGIN
  CREATE ROLE pulse_single_block_failure_probe NOLOGIN;
  RAISE EXCEPTION USING ERRCODE='P9001', MESSAGE='intentional subtransaction failure';
 EXCEPTION WHEN SQLSTATE 'P9001' THEN rejected:=true;
 END;
 IF NOT rejected OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pulse_single_block_failure_probe') THEN RAISE EXCEPTION 'Failure did not roll back'; END IF;
END $prototype$;
SELECT jsonb_build_object('single_block_passed',true,'failure_subtransaction_passed',true,'rollback_follows',true) AS single_block_prototype;
ROLLBACK;
