const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../admin-safety-backend.js'),'utf8');
const production=fs.readFileSync(path.join(__dirname,'../config.js'),'utf8').match(/supabaseUrl:\s*"([^\"]+)"/)[1];
const adminId='00000000-0000-4000-8000-000000000001',calls=[];let who=adminId,returned=[{id:'fake',data:{id:'fake'},updated_at:'next'}],error=null;
const store=new Map(),storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
const client={auth:{onAuthStateChange(){},async getUser(){return who?{data:{user:{id:who}}}:{data:{user:null},error:{}}},async getSession(){return{data:{session:null}}}},from(table){const q={};calls.push(['from',table]);for(const method of ['insert','update','delete','eq','order'])q[method]=(...args)=>{calls.push([method,...args]);return q};q.select=()=>Promise.resolve({data:returned,error});return q}};
const sandbox={window:{supabase:{createClient:(url,key,options)=>{calls.push(['client',url,options.auth.storageKey]);assert.equal(options.auth.storage,storage);return client}}},structuredClone,URL,atob,sessionStorage:storage,location:{hostname:'127.0.0.1'},setTimeout,localStorage:storage};
vm.runInNewContext(code,sandbox);const create=sandbox.window.PULSE_ADMIN_BACKEND.create;
const cfg={mode:'supabase',supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',testProjectRef:'abcdefghijklmnopqrst',publishableKey:'sb_publishable_fake_test_only',adminUserId:adminId};
(async()=>{
 for(const bad of [{...cfg,supabaseUrl:production,testProjectRef:new URL(production).hostname.split('.')[0]},{...cfg,publishableKey:'sb_secret_fake_for_rejection'},{...cfg,adminUserId:''}])await assert.rejects(create(bad),e=>e.code==='CONFIG');assert.equal(calls.length,0);
 const adapter=await create(cfg);await adapter.update({id:'fake'},'old');assert(calls.some(x=>x[0]==='eq'&&x[1]==='id'&&x[2]==='fake'));assert(calls.some(x=>x[0]==='eq'&&x[1]==='updated_at'&&x[2]==='old'));assert.deepEqual(JSON.parse(JSON.stringify(calls.find(x=>x[0]==='update')[1])),{data:{id:'fake'}});
 returned=[];await assert.rejects(adapter.update({id:'fake'},'old'),e=>e.code==='CONFLICT');await assert.rejects(adapter.remove({id:'fake'},'old'),e=>e.code==='CONFLICT');
 error={code:'42501'};await assert.rejects(adapter.insert({id:'fake'}),e=>e.code==='DENIED');error=null;who='other';const before=calls.length;await assert.rejects(adapter.list(),e=>e.code==='DENIED');assert.equal(calls.length,before);who=null;await assert.rejects(adapter.update({id:'fake'},'old'),e=>e.code==='AUTH');
 console.log('PASS adapter contract: production/secret config blocked before SDK; separate auth storage; CAS predicates; zero-row/error/auth handling. Real Auth/RLS not tested.');
})().catch(e=>{console.error(e.message);process.exit(1)});
