-- SEPARATE EMPTY TEST PROJECT ONLY. Do not run on production.
-- Replace the placeholder with the TEST administrator's Auth UUID.
-- CREATE TABLE intentionally has NO IF NOT EXISTS: an existing pulse_matches
-- (including production) aborts this transaction before policy changes.
BEGIN;
CREATE TABLE public.pulse_matches (
  id text PRIMARY KEY,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  data jsonb NOT NULL,
  CONSTRAINT admin_lab_id_matches CHECK (data->>'id' = id)
);
ALTER TABLE public.pulse_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pulse_matches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.pulse_matches TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.pulse_matches TO authenticated;
CREATE POLICY admin_lab_public_read ON public.pulse_matches
FOR SELECT TO anon, authenticated
USING (data @> '{"published":true}'::jsonb);
CREATE POLICY admin_lab_owner ON public.pulse_matches
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = 'REPLACE_WITH_TEST_ADMIN_UUID'::uuid)
WITH CHECK ((SELECT auth.uid()) = 'REPLACE_WITH_TEST_ADMIN_UUID'::uuid);
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
-- No futsal_goods policies, production records, or Auth users are changed here.
