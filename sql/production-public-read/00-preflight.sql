-- PRODUCTION READ-ONLY REVIEW. No keys, URLs, row IDs or policy expressions returned.
BEGIN READ ONLY;
SELECT jsonb_build_object(
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod),'not_null',attnotnull) ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.pulse_matches'::regclass AND attnum>0 AND NOT attisdropped),
 'rls_enabled',(SELECT relrowsecurity FROM pg_class WHERE oid='public.pulse_matches'::regclass),
 'rows',(SELECT count(*) FROM public.pulse_matches),
 'published',(SELECT count(*) FROM public.pulse_matches WHERE data @> '{"published":true}'),
 'unpublished',(SELECT count(*) FROM public.pulse_matches WHERE data @> '{"published":false}'),
 'invalid_publication_type',(SELECT count(*) FROM public.pulse_matches WHERE data->'published' IS NULL OR jsonb_typeof(data->'published')<>'boolean'),
 'id_mismatch',(SELECT count(*) FROM public.pulse_matches WHERE data->>'id' IS DISTINCT FROM id),
 'policies',(SELECT jsonb_agg(jsonb_build_object('command',polcmd,'anon','anon'::regrole::oid=ANY(polroles),'authenticated','authenticated'::regrole::oid=ANY(polroles),'public',0=ANY(polroles),'mentions_auth_uid',coalesce(pg_get_expr(polqual,polrelid),'') LIKE '%auth.uid%') ORDER BY polname) FROM pg_policy WHERE polrelid='public.pulse_matches'::regclass),
 'privileges',(SELECT jsonb_agg(jsonb_build_object('role',r,'privilege',p,'allowed',has_table_privilege(r,'public.pulse_matches',p)) ORDER BY r,p) FROM unnest(ARRAY['anon','authenticated']) r CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES','MAINTAIN']) p),
 'direct_dependent_views',(SELECT count(DISTINCT v.oid) FROM pg_depend d JOIN pg_rewrite w ON w.oid=d.objid JOIN pg_class v ON v.oid=w.ev_class WHERE d.refobjid='public.pulse_matches'::regclass AND v.oid<>d.refobjid AND v.relkind IN ('v','m')),
 'callable_definer_functions_mentioning_original',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND p.prosecdef AND p.prosrc ILIKE '%pulse_matches%' AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))),
 'candidate_role_exists',EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pulse_public_reader_v1'),
 'candidate_rpc_exists',to_regprocedure('public.pulse_public_matches_v1(text)') IS NOT NULL
) AS production_public_read_preflight;
COMMIT;
