/* LAB only. Never copy production credentials here. No secret/service_role keys. */
window.PULSE_ADMIN_LAB_CONFIG = Object.freeze({
  mode: 'local', // 'supabase' requires a separate test project and server CSP change.
  supabaseUrl: '',
  publishableKey: '',
  testProjectRef: '',
  adminUserId: '',
  // This identity is only for the local simulator, not a Supabase administrator.
  mockAdminId: '00000000-0000-4000-8000-000000000001'
});
