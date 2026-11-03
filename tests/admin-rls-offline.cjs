const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createHash}=require('node:crypto');
const ref='a'.repeat(20),config={supabaseUrl:`https://${ref}.supabase.co`,testProjectRef:ref,publishableKey:'sb_publishable_FAKE_LOCAL_ONLY',adminUserId:'00000000-0000-4000-8000-000000000001'};
const source=fs.readFileSync(require.resolve('../tools/admin_rls_test.cjs'),'utf8').replace(/const TEST_REF_SHA256='[a-f0-9]+';/,`const TEST_REF_SHA256='${createHash('sha256').update(ref).digest('hex')}';`);
const sandbox={module:{exports:{}},require,URL,AbortSignal,fetch:()=>{throw Error('REAL NETWORK BLOCKED')}};vm.runInNewContext(source,sandbox);const {runRls}=sandbox.module.exports;
const accounts=[{email:'ADMIN_FAKE@invalid.example',password:'ADMIN_PASSWORD_FAKE'},{email:'OTHER_FAKE@invalid.example',password:'OTHER_PASSWORD_FAKE'}];
async function scenario(options={}){
 const rows=new Map(),calls=[];let stamp=0;
 const fetchImpl=async(url,request)=>{
  const u=new URL(url),method=request.method,body=request.body?JSON.parse(request.body):null,token=request.headers.Authorization;
  assert.equal(u.origin,config.supabaseUrl);assert(['GET','POST','PATCH','DELETE'].includes(method));calls.push([u.pathname,method]);
  const response=(status,data)=>({status,json:async()=>JSON.parse(JSON.stringify(data))});
  if(u.pathname==='/auth/v1/token'){
   const admin=body.email===accounts[0].email;
   if(options.loginFail&&admin)return response(400,{code:'invalid_credentials',message:accounts[0].password});
   return response(200,{access_token:admin?'FAKE_ADMIN_TOKEN':'FAKE_OTHER_TOKEN',user:{id:admin?config.adminUserId:'00000000-0000-4000-8000-000000000002'}});
  }
  if(u.pathname==='/auth/v1/logout')return response(204,{});
  assert.equal(u.pathname,'/rest/v1/pulse_matches');
  if(token==='Bearer INVALID_TEST_JWT')return response(401,{});
  const admin=token==='Bearer FAKE_ADMIN_TOKEN';
  if(method==='POST'){
   if(!admin&&!options.insecureInsert)return response(403,{});
   rows.set(body.id,{...body,updated_at:'stamp-'+(++stamp)});
   if(options.lostInsert&&admin)throw Error('PRIVATE_PROVIDER_ERROR');
   return response(201,[rows.get(body.id)]);
  }
  const filter=u.searchParams.get('id');assert(filter.startsWith('eq.admin-rls-lab-')||filter.startsWith('like.admin-rls-lab-'));
  let found=[...rows.values()].filter(r=>filter.startsWith('eq.')?r.id===filter.slice(3):r.id.startsWith(filter.slice(5,-1)));
  if(!admin)found=found.filter(r=>r.data.published);
  if(method==='GET')return response(200,u.searchParams.get('select')==='id'?found.map(r=>({id:r.id})):found);
  if(!admin)return response(200,[]);
  if(method==='PATCH'){
   const version=u.searchParams.get('updated_at');if(version)found=found.filter(r=>version==='eq.'+r.updated_at);
   found=found.map(r=>({...r,...body,updated_at:'stamp-'+(++stamp)}));for(const r of found)rows.set(r.id,r);return response(200,found);
  }
  if(options.cleanupFail)return response(403,{});
  for(const r of found)rows.delete(r.id);return response(200,found);
 };
 const report=await runRls({config,accounts,productionHostname:'blocked-production.supabase.co',approved:'TEST_MATCH_CRUD',fetchImpl});
 for(const value of [config.publishableKey,...accounts.flatMap(a=>[a.email,a.password]),'FAKE_ADMIN_TOKEN','FAKE_OTHER_TOKEN','PRIVATE_PROVIDER_ERROR'])assert(!JSON.stringify(report).includes(value));
 return {report,rows,calls};
}
(async()=>{
 let s=await scenario();assert(s.report.passed);assert(s.report.requests.match>0);assert.equal(s.report.cleanup,'removed_verified');assert.equal(s.rows.size,0);assert.equal(s.report.auth.length,2);
 s=await scenario({loginFail:true});assert(!s.report.passed);assert.equal(s.report.requests.match,0);assert.equal(s.report.auth[0].code,'invalid_credentials');
 s=await scenario({lostInsert:true});assert(!s.report.passed);assert.equal(s.report.cleanup,'removed_verified');assert.equal(s.rows.size,0);
 s=await scenario({insecureInsert:true});assert(!s.report.passed);assert(s.report.error.includes('UNAUTHORIZED_INSERT'));assert.equal(s.rows.size,0);
 s=await scenario({cleanupFail:true});assert(!s.report.passed);assert(s.report.cleanupPrefix.startsWith('admin-rls-lab-'));assert.equal(s.report.cleanup,'failed_check_test_project');
 let requested=false;
 for(const overrides of [{approved:''},{config:{...config,testProjectRef:'b'.repeat(20),supabaseUrl:`https://${'b'.repeat(20)}.supabase.co`}},{productionHostname:ref+'.supabase.co'},{config:{...config,publishableKey:'sb_secret_NOT_ALLOWED'}}])await assert.rejects(runRls({config,accounts,productionHostname:'blocked-production.supabase.co',approved:'TEST_MATCH_CRUD',fetchImpl:()=>{requested=true},...overrides}));
 assert.equal(requested,false);
 console.log('PASS offline RLS: client-role CRUD, private visibility, conflict, invalid JWT, own-row cleanup, lost response, insecure policy detection, cleanup failure, pinned-project and approval guards; real requests 0.');
})().catch(()=>{console.error('Offline RLS test failed; fixture values omitted.');process.exitCode=1});
