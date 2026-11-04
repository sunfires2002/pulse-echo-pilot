-- Read only: run before preparation and again after; compare output exactly.
BEGIN READ ONLY;
SELECT jsonb_build_object(
 'data_hash',(SELECT md5(coalesce(string_agg(id||chr(31)||updated_at::text||chr(31)||data::text,chr(30) ORDER BY id),'')) FROM public.pulse_matches),
 'policy_hash',(SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid)::text,'')) FROM pg_policy p WHERE p.polrelid='public.pulse_matches'::regclass AND p.polname<>'pulse_public_reader_v1'),
 'table_acl_hash',(SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type)::text,'')) FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.pulse_matches'::regclass AND a.grantee IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='pulse_public_reader_v1')),
 'schema_acl_hash',(SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type)::text,'')) FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='public' AND a.grantee IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='pulse_public_reader_v1')),
 'membership_hash',(SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'')) FROM pg_auth_members m WHERE m.roleid IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='pulse_public_reader_v1') AND m.member IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='pulse_public_reader_v1')),
 'rls',(SELECT jsonb_build_object('enabled',relrowsecurity,'forced',relforcerowsecurity) FROM pg_class WHERE oid='public.pulse_matches'::regclass),
 'goods_metadata',(SELECT md5(jsonb_build_object('acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity,'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid=c.oid))::text) FROM pg_class c WHERE c.oid=to_regclass('public.futsal_goods'))
) AS preparation_baseline;
COMMIT;
