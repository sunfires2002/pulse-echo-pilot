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
 const cfg={supabaseUrl:'https://example.invalid',supabaseAnonKey:'fixture'};
 const basic=app(cfg),rows=await basic.api.load();assert.equal(rows.length,1);assert.equal(Object.keys(rows[0]).length,12);assert.equal(rows[0].round,'');assert(basic.calls[0].url.endsWith('/rest/v1/rpc/pulse_public_matches_v1'));assert.equal(basic.calls[0].options.method,'GET');assert.equal(basic.calls[0].options.credentials,'omit');assert.equal(basic.calls[0].options.cache,'no-store');count++;
 assert.equal((await app(cfg,[]).api.load()).length,0);count++;
 await assert.rejects(()=>app(cfg,[],false).api.load());count++;
 for(const bad of [{...row,workflow:{}},{...row,published:false},{...row,firstHalfVideo:'https://youtu.be/M7lc1UVf-VE'},{...row,homeScore:-1}]){await assert.rejects(()=>app(cfg,[bad]).api.load());count++}
 const fixed=app({...cfg,publicMatchesRpc:'../private'});await fixed.api.load();assert(fixed.calls[0].url.endsWith('/pulse_public_matches_v1'));count++;
 const id='試合-20261104',a=app(cfg,[{...row,id}]);assert.equal((await a.api.load(id))[0].id,id);assert.equal(new URL(a.calls[0].url).searchParams.get('requested_id'),id);count++;
 await assert.rejects(()=>app(cfg).api.load('wrong-id'));count++;
 console.log(JSON.stringify({passed:true,contractChecks:count,networkRequests:0}));
})().catch(()=>{console.error('PUBLIC_READ_CONTRACT_FAILED');process.exitCode=1});
