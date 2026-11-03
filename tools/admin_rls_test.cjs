/* TEST-only client RLS exercise. No admin/secret keys; no production access. */
const {createHash,randomUUID}=require('node:crypto');
const TEST_REF_SHA256='808bf65cd5d0a599e7a0470d1670c128bd5e2a6445ef5111d5c9994de1f5ac35';
const fail=code=>{throw Object.assign(new Error(code),{safeCode:code})};
function validate(config,productionHostname){
 const u=new URL(config.supabaseUrl);
 if(!/^[a-z0-9]{20}$/.test(config.testProjectRef)||u.href!==`https://${config.testProjectRef}.supabase.co/`||u.hostname===productionHostname||createHash('sha256').update(config.testProjectRef).digest('hex')!==TEST_REF_SHA256||!/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(config.publishableKey)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.adminUserId))fail('TEST_CONFIG_REJECTED');
 return u.origin;
}
async function runRls({config,accounts,productionHostname,approved,fetchImpl=fetch}){
 if(approved!=='TEST_MATCH_CRUD')fail('EXPLICIT_TEST_MATCH_APPROVAL_REQUIRED');
 const base=validate(config,productionHostname);
 if(accounts.length!==2||accounts.some(a=>!a.email||!a.password)||accounts[0].email.toLowerCase()===accounts[1].email.toLowerCase())fail('TEST_ACCOUNTS_REJECTED');
 const prefix='admin-rls-lab-'+randomUUID(),tokens=[],checks=[],auth=[],counts={auth:0,match:0};
 let adminToken,cleanup='not_needed',error=null;
 const ensure=(condition,code)=>{if(!condition)fail(code)};
 async function request(route,method='GET',body,token){
  const url=new URL(route,base),params=url.searchParams;
  const authAllowed=(url.pathname==='/auth/v1/token'&&method==='POST'&&url.search==='?grant_type=password')||(url.pathname==='/auth/v1/logout'&&method==='POST'&&url.search==='?scope=local');
  const matchAllowed=url.pathname==='/rest/v1/pulse_matches'&&(
   method==='POST'&&!url.search&&body?.id?.startsWith(prefix+'-')&&body.data?.id===body.id||
   ['GET','PATCH','DELETE'].includes(method)&&['eq.','like.'].some(op=>params.get('id')?.startsWith(op+prefix))&&
    [...params.keys()].every(k=>['id','select','updated_at'].includes(k)));
  ensure(url.origin===base&&(authAllowed||matchAllowed),'REQUEST_BLOCKED');
  if(authAllowed)counts.auth++;else counts.match++;
  try{
   const response=await fetchImpl(url.href,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{apikey:config.publishableKey,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
   let data;try{data=await response.json()}catch{}
   return {status:response.status,data};
  }catch{fail('TEST_TRANSPORT_FAILURE')}
 }
 const row=(suffix,published)=>{const id=prefix+'-'+suffix;return{id,data:{id,date:'2026-11-03',home:'RLS TEST A',away:'RLS TEST B',homeScore:0,awayScore:0,firstHalfVideo:'',secondHalfVideo:'',published}}};
 const query=id=>'/rest/v1/pulse_matches?id=eq.'+encodeURIComponent(id);
 const all='/rest/v1/pulse_matches?id=like.'+prefix+'*&select=id';
 const denied=r=>[401,403].includes(r.status)||(r.status===200&&Array.isArray(r.data)&&r.data.length===0);
 try{
  // Both account identities must be verified before any match request.
  for(let i=0;i<2;i++){
   const r=await request('/auth/v1/token?grant_type=password','POST',{email:accounts[i].email,password:accounts[i].password});
   if(r.status===200&&typeof r.data?.access_token==='string')tokens.push(r.data.access_token);
   const allowedCodes=['invalid_credentials','email_not_confirmed','over_request_rate_limit','over_email_send_rate_limit','invalid_grant'];
   const rawCode=r.data?.code||r.data?.error_code||r.data?.error;
   auth.push({role:i?'non_admin':'admin',status:r.status,code:r.status===200?'ok':allowedCodes.includes(rawCode)?rawCode:'unclassified_auth_error'});
   ensure(r.status===200&&typeof r.data?.access_token==='string'&&r.data.user?.id,'AUTH_'+(i?'NON_ADMIN':'ADMIN')+'_FAILED');
   ensure((r.data.user.id===config.adminUserId)===(i===0),'AUTH_ROLE_UUID_MISMATCH');
   if(i===0)adminToken=r.data.access_token;
  }
  const privateRow=row('private',false),publicRow=row('public',true);
  // Mark cleanup necessary BEFORE the first request: a lost reply may still insert.
  cleanup='pending';
  for(const r of [privateRow,publicRow]){
   const insert=await request('/rest/v1/pulse_matches','POST',r,adminToken);
   ensure(insert.status===201&&insert.data?.[0]?.id===r.id,'ADMIN_INSERT_FAILED');
  }
  checks.push('admin_insert_public_private');
  for(const [role,token] of [['anonymous',undefined],['non_admin',tokens[1]]]){
   const list=await request(all,'GET',undefined,token);
   ensure(list.status===200&&Array.isArray(list.data)&&list.data.length===1&&list.data[0].id===publicRow.id,'PUBLIC_SELECT_'+role+'_FAILED');
   const hidden=await request(query(privateRow.id)+'&select=id','GET',undefined,token);
   ensure(hidden.status===200&&Array.isArray(hidden.data)&&hidden.data.length===0,'PRIVATE_SELECT_'+role+'_LEAK');
   const insert=await request('/rest/v1/pulse_matches','POST',row(role+'-denied',false),token);
   ensure([401,403].includes(insert.status),'UNAUTHORIZED_INSERT_'+role+'_ACCEPTED');
   for(const method of ['PATCH','DELETE']){
    const result=await request(query(publicRow.id),method,method==='PATCH'?{data:{...publicRow.data,home:'FORBIDDEN'}}:undefined,token);
    ensure(denied(result),'UNAUTHORIZED_'+method+'_'+role+'_ACCEPTED');
   }
   checks.push(role+'_public_only_and_write_denied');
  }
  const initialResult=await request(query(publicRow.id),'GET',undefined,adminToken),initial=initialResult.data?.[0];
  ensure(initialResult.status===200&&initial?.data?.home==='RLS TEST A','UNAUTHORIZED_CHANGE_DETECTED');
  const cas=query(publicRow.id)+'&updated_at=eq.'+encodeURIComponent(initial.updated_at);
  const update=await request(cas,'PATCH',{data:{...initial.data,venue:'ADMIN ONLY'}},adminToken);
  ensure(update.status===200&&update.data?.length===1&&update.data[0].updated_at!==initial.updated_at,'ADMIN_UPDATE_OR_TIMESTAMP_FAILED');
  const stale=await request(cas,'PATCH',{data:{...initial.data,venue:'STALE'}},adminToken);
  ensure(stale.status===200&&Array.isArray(stale.data)&&stale.data.length===0,'STALE_UPDATE_ACCEPTED');
  const after=await request(query(publicRow.id),'GET',undefined,adminToken);
  ensure(after.status===200&&after.data?.[0]?.data?.venue==='ADMIN ONLY','STALE_UPDATE_CHANGED_ROW');
  checks.push('admin_update_and_conflict_rejection');
  const invalid=await request(query(publicRow.id),'PATCH',{data:publicRow.data},'INVALID_TEST_JWT');
  ensure([401,403].includes(invalid.status),'INVALID_JWT_ACCEPTED');
  checks.push('invalid_jwt_write_denied_not_natural_expiry_test');
 }catch(e){error=e.safeCode||'TEST_FAILED_DETAILS_REDACTED'}
 finally{
  if(cleanup==='pending'&&adminToken){
   try{
    const removed=await request('/rest/v1/pulse_matches?id=like.'+prefix+'*','DELETE',undefined,adminToken);
    ensure(removed.status===200&&Array.isArray(removed.data),'CLEANUP_DELETE_FAILED');
    const remaining=await request(all,'GET',undefined,adminToken);
    ensure(remaining.status===200&&Array.isArray(remaining.data)&&remaining.data.length===0,'CLEANUP_ROWS_REMAIN');
    cleanup='removed_verified';checks.push('admin_delete_and_run_rows_removed');
   }catch{cleanup='failed_check_test_project';error=error||'CLEANUP_FAILED'}
  }
  // End only sessions created by this invocation; never claim JWTs revoke instantly.
  for(const token of tokens){try{const r=await request('/auth/v1/logout?scope=local','POST',undefined,token);ensure([200,204].includes(r.status),'LOGOUT_FAILED')}catch{error=error||'LOGOUT_FAILED'}}
 }
 return {passed:!error,error,auth,checks,requests:counts,cleanup,...(cleanup==='failed_check_test_project'?{cleanupPrefix:prefix}:{}),notTested:['natural_jwt_expiry','browser_ui','production']};
}
module.exports={runRls,validate};
