-- TEST PROJECT ONLY. Temporary test table; final rollback. No production objects touched.
BEGIN;
DO $guard$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.pulse_matches') AND conname='admin_lab_id_matches') THEN
  RAISE EXCEPTION 'Security LAB marker missing';
 END IF;
END $guard$;
CREATE TEMP TABLE lab_temp_diagnostic ON COMMIT DROP AS
 SELECT pg_backend_pid() AS first_pid, txid_current() AS first_txid;
DO $check$
DECLARE saved lab_temp_diagnostic%ROWTYPE;
BEGIN
 SELECT * INTO STRICT saved FROM lab_temp_diagnostic;
 IF saved.first_pid <> pg_backend_pid() OR saved.first_txid <> txid_current() THEN
  RAISE EXCEPTION 'Execution connection or transaction changed';
 END IF;
END $check$;
SELECT jsonb_build_object('same_connection',first_pid=pg_backend_pid(),'same_transaction',first_txid=txid_current(),'rowtype_visible',true,'rollback_follows',true) AS temp_transaction_diagnostic FROM lab_temp_diagnostic;
ROLLBACK;
