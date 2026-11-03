-- SEPARATE EMPTY TEST PROJECT ONLY: pulse-echo-security-lab.
-- REVIEW ONLY until approved. Never run against production.
-- First create and confirm the TEST administrator in Authentication > Users.
-- Replace the ONE UUID placeholder below. Never put a password or key here.
-- No IF NOT EXISTS: an existing pulse_matches aborts the transaction.
BEGIN;
CREATE TABLE public.pulse_matches (
  id text PRIMARY KEY,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  data jsonb NOT NULL,
  CONSTRAINT admin_lab_id_matches CHECK (
    jsonb_typeof(data) = 'object'
    AND data ? 'id'
    AND jsonb_typeof(data->'id') = 'string'
    AND data->>'id' = id
  )
);
-- Harmless when Automatic RLS has already enabled it.
ALTER TABLE public.pulse_matches ENABLE ROW LEVEL SECURITY;
-- Explicit access: do not depend on automatic/default grants.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
REVOKE ALL ON TABLE public.pulse_matches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.pulse_matches TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.pulse_matches TO authenticated;

DO $admin_policy$
DECLARE
  lab_admin_id uuid := 'REPLACE_WITH_TEST_ADMIN_UUID'::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = lab_admin_id
      AND email IS NOT NULL
      AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Create and confirm the test administrator first; check the Auth user UUID.';
  END IF;
  -- If a platform event trigger supplied unexpected policies, stop for review.
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pulse_matches'
  ) THEN
    RAISE EXCEPTION 'Unexpected policies on the new test table; review before proceeding.';
  END IF;
  -- Render a UUID literal into the policy. Never trust a client-set variable.
  EXECUTE format(
    'CREATE POLICY admin_lab_owner ON public.pulse_matches
     FOR ALL TO authenticated
     USING ((SELECT auth.uid()) = %L::uuid)
     WITH CHECK ((SELECT auth.uid()) = %L::uuid)',
    lab_admin_id, lab_admin_id
  );
END;
$admin_policy$;

CREATE POLICY admin_lab_public_read ON public.pulse_matches
FOR SELECT TO anon, authenticated
USING (data @> '{"published":true}'::jsonb);

CREATE FUNCTION public.admin_lab_touch_match() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := greatest(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_lab_touch_match() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER admin_lab_match_version BEFORE UPDATE ON public.pulse_matches
FOR EACH ROW EXECUTE FUNCTION public.admin_lab_touch_match();
COMMIT;
-- No sample rows, Auth accounts, futsal_goods, or production objects are changed.
-- On any error, ROLLBACK and investigate. Do not add IF NOT EXISTS or GRANT ALL.
