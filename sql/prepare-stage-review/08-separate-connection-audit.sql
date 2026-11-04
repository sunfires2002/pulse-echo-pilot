-- TEST PROJECT ONLY. Run after setup committed.
-- READ ONLY. Execute only after prepare was committed. Compare baseline hashes manually.
BEGIN READ ONLY;
SELECT jsonb_build_object(
 'total_rows',(SELECT count(*) FROM public.privacy_cutover_matches),
 'published',(SELECT count(*) FROM public.privacy_cutover_matches WHERE data @> '{"published":true}'),
 'unpublished',(SELECT count(*) FROM public.privacy_cutover_matches WHERE data @> '{"published":false}'),
 'public_rows',(SELECT count(*) FROM public.privacy_cutover_public_matches_v1()),
 'nonpublic_returned',(SELECT count(*) FROM public.privacy_cutover_matches m CROSS JOIN LATERAL public.privacy_cutover_public_matches_v1(m.id) f WHERE NOT (m.data @> '{"published":true}')),
 'fields_match',(SELECT bool_and((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(to_jsonb(f)) k)=ARRAY['away','awayScore','competition','date','firstHalfVideo','highlightVideo','home','homeScore','id','published','round','secondHalfVideo']::text[]) FROM public.privacy_cutover_public_matches_v1() f),
 'video_counts',(SELECT jsonb_build_object('nonempty',count(*),'invalid',count(*) FILTER(WHERE public.privacy_cutover_video_id_v1(v) IS NULL)) FROM public.privacy_cutover_matches m CROSS JOIN LATERAL (VALUES(m.data->'firstHalfVideo'),(m.data->'secondHalfVideo'),(m.data->'highlightVideo')) x(v) WHERE v IS NOT NULL AND v<>'null'::jsonb AND v<>'""'::jsonb),
 'reader_safe',(SELECT NOT rolcanlogin AND NOT rolbypassrls AND NOT rolsuper FROM pg_roles WHERE rolname='pulse_privacy_cutover_reader'),
 'reader_select',has_table_privilege('pulse_privacy_cutover_reader','public.privacy_cutover_matches','SELECT'),
 'reader_write',has_table_privilege('pulse_privacy_cutover_reader','public.privacy_cutover_matches','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN'),
 'anon_rpc',has_function_privilege('anon','public.privacy_cutover_public_matches_v1(text)','EXECUTE'),
 'authenticated_rpc',has_function_privilege('authenticated','public.privacy_cutover_public_matches_v1(text)','EXECUTE'),
 'anon_original_select',has_table_privilege('anon','public.privacy_cutover_matches','SELECT'),
 'anon_original_write',has_table_privilege('anon','public.privacy_cutover_matches','INSERT,UPDATE,DELETE'),
 'rls_enabled',(SELECT relrowsecurity FROM pg_class WHERE oid='public.privacy_cutover_matches'::regclass)
) AS prepare_independent_review;
COMMIT;
