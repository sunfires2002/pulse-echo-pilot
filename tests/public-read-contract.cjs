/* Offline API boundary/legacy-config compatibility. No network. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').resolve(__dirname,'../public-matches.js'),'utf8');
const row={id:'sample-a',date:'2026-11-04',competition:'サンプル',round:null,home:'A',away:'B',homeScore:1,awayScore:0,firstHalfVideo:'M7lc1UVf-VE',secondHalfVideo:'aqz-KE-bpKQ',highlightVideo:null,published:true};
function app(config,body=[row],ok=true){
 const calls=[],window={PULSE_CONFIG:config};Object.defineProperty(window,'PULSE_MATCHES',{get(){throw Error('STATIC_FALLBACK_USED')}});
 const localStorage=new Proxy({},{get(){throw Error('STORAGE_FALLBACK_USED')}});
 vm.runInNewContext(source,{window,localStorage,URL,AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{calls.push({url:String(url),options});return {ok,json:async()=>body}}});
 return {api:window.PULSE_PUBLIC_MATCHES,calls};
}
(async()=>{
 let count=0;
 for(const [config,name]of [[{publicApiUrl:'https://example.invalid',publicApiKey:'fixture',publicMatchesRpc:'public_privacy_matches'},'public_privacy_matches'],[{supabaseUrl:'https://example.invalid',supabaseAnonKey:'fixture'},'pulse_public_matches_v1'],[{publicApiUrl:'https://example.invalid',publicApiKey:'fixture',publicMatchesRpc:'privacy_cutover_public_matches_v1'},'privacy_cutover_public_matches_v1']]){
  const a=app(config),rows=await a.api.load();assert.equal(rows.length,1);assert.equal(Object.keys(rows[0]).length,12);assert.equal(rows[0].round,'');assert(a.calls[0].url.endsWith('/rest/v1/rpc/'+name));assert.equal(a.calls[0].options.method,'GET');assert.equal(a.calls[0].options.credentials,'omit');assert.equal(a.calls[0].options.cache,'no-store');assert(!a.calls[0].options.headers.Authorization);count++;
 }
 const cfg={publicApiUrl:'https://example.invalid',publicApiKey:'fixture'};
 assert.equal((await app(cfg,[]).api.load()).length,0);count++;
 await assert.rejects(()=>app(cfg,[],false).api.load());count++;
 for(const bad of [{...row,workflow:{}},{...row,published:false},{...row,firstHalfVideo:'https://youtu.be/M7lc1UVf-VE'},{...row,homeScore:-1}]){await assert.rejects(()=>app(cfg,[bad]).api.load());count++}
 const invalid=app({...cfg,publicMatchesRpc:'../private'});await assert.rejects(()=>invalid.api.load());assert.equal(invalid.calls.length,0);count++;
 const id='試合-20261104',a=app(cfg,[{...row,id}]);assert.equal((await a.api.load(id))[0].id,id);assert.equal(new URL(a.calls[0].url).searchParams.get('requested_id'),id);count++;
 await assert.rejects(()=>app(cfg).api.load('wrong-id'));count++;
 console.log(JSON.stringify({passed:true,contractChecks:count,networkRequests:0}));
})().catch(()=>{console.error('PUBLIC_READ_CONTRACT_FAILED');process.exitCode=1});
