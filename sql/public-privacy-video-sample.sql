-- TEST ONLY: optional repair for the old second-half sample blocked by YouTube.
-- New installations using public-privacy-video-conversion.sql already use this sample.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR obj_description(to_regclass('public.privacy_lab_matches'),'pg_class')
 IS DISTINCT FROM 'public-information-protection-lab fictional fixtures only'
 THEN RAISE EXCEPTION 'Privacy LAB only; STOP'; END IF;
END $$;
UPDATE public.privacy_lab_matches
SET data=jsonb_set(data,'{secondHalfVideo}',to_jsonb('https://youtu.be/aqz-KE-bpKQ?si=privacy-lab'::text))
WHERE id='privacy-sample-a';
COMMIT;
SELECT "secondHalfVideo"='aqz-KE-bpKQ' AS second_sample_ready
FROM public.public_privacy_matches('privacy-sample-a');
