/* Auth routes ONLY. No Data API, account changes, retries, or raw response logging. */
const SAFE_AUTH_CODES = new Set([
 'invalid_credentials','email_not_confirmed','phone_not_confirmed','user_banned',
 'over_request_rate_limit','over_email_send_rate_limit','over_sms_send_rate_limit',
 'email_provider_disabled','phone_provider_disabled','signup_disabled','captcha_failed',
 'validation_failed','bad_json','unexpected_failure','request_timeout','invalid_jwt',
 'email_address_invalid','email_address_not_authorized','no_authorization','bad_jwt',
 'provider_disabled','insufficient_aal','hook_timeout','hook_timeout_after_retry',
 'session_not_found','session_expired','refresh_token_not_found','refresh_token_already_used'
]);
const SAFE_OAUTH_CODES = new Set(['invalid_grant','invalid_request','unauthorized_client',
 'access_denied','unsupported_grant_type','invalid_client','server_error','temporarily_unavailable']);
const statusOf = response => Number.isInteger(response?.status)&&response.status>=100&&response.status<=599?response.status:null;
function codeOf(body) {
 for (const code of [body?.error_code,body?.code]) if (SAFE_AUTH_CODES.has(code)) return code;
 return SAFE_OAUTH_CODES.has(body?.error)?body.error:'unclassified_auth_error';
}
function category(status,code) {
 if(status===429||code.startsWith('over_'))return 'rate_limit';
 if(code==='email_address_invalid')return 'email_format_or_domain_rejected';
 if(code==='email_address_not_authorized')return 'email_send_restricted';
 if(code==='insufficient_aal')return 'additional_authentication_required';
 if(code==='email_not_confirmed')return 'email_unconfirmed';
 if(code==='invalid_credentials')return 'credential_pair_not_accepted';
 if(code==='user_banned')return 'account_blocked';
 if(code==='email_provider_disabled')return 'email_provider_disabled';
 if(code==='captcha_failed')return 'captcha_required_or_failed';
 if(status===401)return 'key_or_authentication_rejected';
 if(status===null)return 'transport_error';
 return 'auth_error_needs_review';
}
async function diagnose({config,accounts,productionHostname,fetchImpl=globalThis.fetch}) {
 let url;
 try {url=new URL(config.supabaseUrl)} catch {throw Error('Invalid TEST configuration')}
 if(url.protocol!=='https:'||url.hostname!==config.testProjectRef+'.supabase.co'||
    !/^[a-z0-9]{20}$/.test(config.testProjectRef)||url.hostname===productionHostname||
    url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/'||
    !/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(config.publishableKey)||
    !/^[a-f0-9-]{36}$/i.test(config.adminUserId))throw Error('Invalid or forbidden TEST configuration');
 if(accounts.length!==2||accounts[0].role!=='admin'||accounts[1].role!=='non_admin'||
    accounts.some(a=>!a.email||typeof a.password!=='string'||!a.password))throw Error('Two TEST roles are required');
 const results=[];let stop=null;
 async function authRequest(route,body,token) {
  if(!['/auth/v1/token?grant_type=password','/auth/v1/logout?scope=local'].includes(route))throw Error('Forbidden route');
  return fetchImpl(new URL(route,url.origin),{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
   headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
 }
 for(const account of accounts) {
  if(stop){results.push({role:account.role,status:null,code:'not_attempted',category:stop,roleCheck:'not_checked'});continue}
  let response,body;
  try{response=await authRequest('/auth/v1/token?grant_type=password',{email:account.email,password:account.password});try{body=await response.json()}catch{body=null}}
  catch{results.push({role:account.role,status:null,code:'transport_error',category:'transport_error',roleCheck:'not_checked'});stop='stopped_after_transport_error';continue}
  const status=statusOf(response),token=typeof body?.access_token==='string'?body.access_token:null;
  const successful=status===200&&!!token&&typeof body?.user?.id==='string';
  const result={role:account.role,status,code:successful?'none':codeOf(body),
   category:successful?'authenticated':category(status,codeOf(body)),roleCheck:'not_checked'};
  if(status===200&&!successful){result.code='invalid_success_response';result.category='invalid_auth_response'}
  if(successful){const expected=account.role==='admin'?body.user.id===config.adminUserId:body.user.id!==config.adminUserId;result.roleCheck=expected?'matched':'mismatch'}
  if(result.category==='rate_limit'){
   const retry=response.headers?.get('Retry-After');if(typeof retry==='string'&&/^\d{1,5}$/.test(retry))result.retryAfterSeconds=Number(retry);
   stop='stopped_after_rate_limit';
  }
  // End only this newly-created session. Never touch tables or other sessions.
  if(status===200&&token){
   try{const logout=await authRequest('/auth/v1/logout?scope=local',undefined,token);result.sessionCleanupStatus=statusOf(logout);if(result.sessionCleanupStatus===429)stop='stopped_after_rate_limit'}
   catch{result.sessionCleanupStatus=null}
  }
  results.push(result);
 }
 return {authOnly:true,matchRequests:0,results};
}
module.exports={diagnose,codeOf,category};
