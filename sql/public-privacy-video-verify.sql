-- Separate privacy LAB only. Read-only verification; no original values returned.
BEGIN READ ONLY;
WITH cases(value,expected) AS (VALUES
 ('"M7lc1UVf-VE"'::jsonb,'M7lc1UVf-VE'),
 ('"https://youtu.be/M7lc1UVf-VE"'::jsonb,'M7lc1UVf-VE'),
 ('" https://youtu.be/M7lc1UVf-VE?si=sample#x "'::jsonb,'M7lc1UVf-VE'),
 ('"https://www.youtu.be/M7lc1UVf-VE?t=60"'::jsonb,'M7lc1UVf-VE'),
 ('null'::jsonb,NULL),('""'::jsonb,NULL),('42'::jsonb,NULL),('{}'::jsonb,NULL),
 ('"https://youtu.be/M7lc1UVf-VE/extra"'::jsonb,NULL),
 ('"https://youtu.be.evil.invalid/M7lc1UVf-VE"'::jsonb,NULL),
 ('"https://user@youtu.be/M7lc1UVf-VE"'::jsonb,NULL),
 ('"https://youtu.be:443/M7lc1UVf-VE"'::jsonb,NULL),
 ('"http://youtu.be/M7lc1UVf-VE"'::jsonb,NULL),
 ('"javascript:alert(1)"'::jsonb,NULL),
 ('"https://youtu.be/invalid"'::jsonb,NULL)
)
SELECT jsonb_build_object(
 'conversion_cases_passed',(SELECT count(*) FROM cases WHERE public.privacy_lab_youtube_id(value) IS NOT DISTINCT FROM expected),
 'conversion_cases_failed',(SELECT count(*) FROM cases WHERE public.privacy_lab_youtube_id(value) IS DISTINCT FROM expected),
 'first_half_converted',(SELECT "firstHalfVideo"='M7lc1UVf-VE' FROM public.public_privacy_matches('privacy-sample-a')),
 'second_half_converted',(SELECT "secondHalfVideo"='aqz-KE-bpKQ' FROM public.public_privacy_matches('privacy-sample-a')),
 'invalid_reported',(SELECT sum(invalid)=1 FROM public.privacy_lab_video_audit()),
 'invalid_public_field_empty',(SELECT "highlightVideo" IS NULL FROM public.public_privacy_matches('privacy-sample-b')),
 'anon_original_blocked',NOT has_table_privilege('anon','public.privacy_lab_matches','SELECT'),
 'authenticated_original_blocked',NOT has_table_privilege('authenticated','public.privacy_lab_matches','SELECT'),
 'anon_audit_blocked',NOT has_function_privilege('anon','public.privacy_lab_video_audit()','EXECUTE'),
 'authenticated_audit_blocked',NOT has_function_privilege('authenticated','public.privacy_lab_video_audit()','EXECUTE'),
 'anon_converter_blocked',NOT has_function_privilege('anon','public.privacy_lab_youtube_id(jsonb)','EXECUTE'),
 'public_twelve_fields',(SELECT count(*)=12 FROM jsonb_object_keys((SELECT to_jsonb(m) FROM public.public_privacy_matches('privacy-sample-a') m))),
 'private_hidden',NOT EXISTS(SELECT 1 FROM public.public_privacy_matches('privacy-sample-hidden'))
) AS video_conversion_verification;
COMMIT;
