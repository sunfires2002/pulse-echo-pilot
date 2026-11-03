/* Optional test-project-only RLS integration. Never use production credentials. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const names=['ADMIN_TEST_URL','ADMIN_TEST_KEY','ADMIN_TEST_ADMIN_EMAIL','ADMIN_TEST_ADMIN_PASSWORD','ADMIN_TEST_OTHER_EMAIL','ADMIN_TEST_OTHER_PASSWORD'];
if(names.some(k=>!process.env[k])){console.log('SKIP real Auth/RLS: separate test project and accounts are not configured.');process.exit(0)}
const [base,key,adminEmail,adminPassword,otherEmail,otherPassword]=names.map(k=>process.env[k]);
const production=fs.readFileSync(path.join(__dirname,'../config.js'),'utf8').match(/supabaseUrl:\s*"([^\"]+)"/)[1];
assert.notEqual(new URL(base).origin,new URL(production).origin,'Production is forbidden');
assert.match(new URL(base).hostname,/^[a-z0-9]{20}\.supabase\.co$/);assert.equal(new URL(base).protocol,'https:');assert(key.startsWith('sb_publishable_'),'Only a test publishable key is accepted');
const prefix='admin-rls-lab-'+crypto.randomUUID();let adminToken;
async function request(route,method='GET',body,token){const response=await fetch(new URL(route,base),{method,headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await response.json()}catch{}return{status:response.status,data}}
async function login(email,password){const r=await request('/auth/v1/token?grant_type=password','POST',{email,password});assert.equal(r.status,200,'Test account login failed');assert(r.data.access_token);return r.data.access_token}
const row=(suffix,published)=>{const id=prefix+'-'+suffix;return{id,data:{id,date:'2026-11-03',home:'RLS TEST A',away:'RLS TEST B',homeScore:0,awayScore:0,firstHalfVideo:'',secondHalfVideo:'',published}}};
(async()=>{try{
 adminToken=await login(adminEmail,adminPassword);const other=await login(otherEmail,otherPassword),privateRow=row('private',false),publicRow=row('public',true);
 for(const r of [privateRow,publicRow])assert.equal((await request('/rest/v1/pulse_matches','POST',r,adminToken)).status,201,'Administrator cannot insert; UUID/RLS must be checked');
 for(const token of [undefined,other]){
  const list=await request('/rest/v1/pulse_matches?select=id&id=like.'+prefix+'*','GET',undefined,token);assert.equal(list.status,200);assert.deepEqual(list.data.map(x=>x.id),[publicRow.id]);
  const insert=await request('/rest/v1/pulse_matches','POST',row(token?'other-denied':'anon-denied',false),token);assert([401,403].includes(insert.status),'Unauthorized insert was accepted');
  for(const method of ['PATCH','DELETE']){const denied=await request('/rest/v1/pulse_matches?id=eq.'+publicRow.id,method,method==='PATCH'?{data:{...publicRow.data,home:'FORBIDDEN'}}:undefined,token);assert([401,403].includes(denied.status)||(denied.status===200&&Array.isArray(denied.data)&&denied.data.length===0),'Unauthorized mutation was accepted')}
 }
 const initial=(await request('/rest/v1/pulse_matches?id=eq.'+publicRow.id,'GET',undefined,adminToken)).data[0];assert.equal(initial.data.home,'RLS TEST A');
 const update=await request('/rest/v1/pulse_matches?id=eq.'+publicRow.id+'&updated_at=eq.'+encodeURIComponent(initial.updated_at),'PATCH',{data:{...initial.data,venue:'ADMIN ONLY'}},adminToken);assert.equal(update.status,200);assert.equal(update.data.length,1);assert.notEqual(update.data[0].updated_at,initial.updated_at);
 const stale=await request('/rest/v1/pulse_matches?id=eq.'+publicRow.id+'&updated_at=eq.'+encodeURIComponent(initial.updated_at),'PATCH',{data:{...initial.data,venue:'STALE'}},adminToken);assert.equal(stale.status,200);assert.deepEqual(stale.data,[]);
 const after=(await request('/rest/v1/pulse_matches?id=eq.'+publicRow.id,'GET',undefined,adminToken)).data[0];assert.equal(after.data.venue,'ADMIN ONLY');
 console.log('PASS separate-project RLS: anonymous/non-admin denied; admin CRUD; public/private SELECT; stale update denied.');
 }finally{if(adminToken){const cleanup=await request('/rest/v1/pulse_matches?id=like.'+prefix+'*','DELETE',undefined,adminToken);assert.equal(cleanup.status,200,'Remove this test run records manually in the TEST project');}}
})().catch(e=>{console.error(e.message);process.exit(1)});
