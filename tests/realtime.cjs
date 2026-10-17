const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('match.html','utf8'),base=require('child_process').execFileSync('git',['show','0c48160a4fe2b5cd4ed5d7f78c09a618c734b17f:match.html'],{encoding:'utf8'});
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(s=>s[1].trim()).at(-1)[1];new vm.Script(script);
const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
for(const [a,b] of [['function loadVideo(', 'function tacticLayer('],['function echoText(', 'function setInfoPanel('],['function draw(', 'window.deleteEvent=']]) assert.equal(section(html,a,b),section(base,a,b),a+' unchanged');
// Desktop/legacy voice preservation is verified separately in pc-voice.cjs.
let channels=[],removed=[],queries=[],flown=[],renders=0,insertResolve;
const ctx={console,window:{addEventListener:()=>{}},alert:()=>{},localStorage:{getItem:()=> '[]'},document:{getElementById:id=>id==='userName'?{value:'Alice'}:{value:''}},setTimeout};
vm.createContext(ctx);
vm.runInContext(`let match={id:'match'},currentPart='前半',events=[],echoPlayed=new Set(),recentManualEchoes=[];const reactionTable=()=> 'futsal_goods';const key=()=> 'local';function startEchoPlayback(){}function nowTime(){return 10}function echoText(e){return e.user_name+'：'+e.comment}function fly(s){flown(s)}function render(){rendered()}let supa;`,ctx);
ctx.flown=s=>flown.push(s);ctx.rendered=()=>renders++;
ctx.mock={channel:key=>{const c={key,on:(type,filter,cb)=>{c.cb=cb;c.filter=filter;return c},subscribe:cb=>{c.status=cb;return c}};channels.push(c);return c},removeChannel:c=>removed.push(c),from:()=>({select:()=>({eq:()=>({order:()=>new Promise(resolve=>queries.push(resolve))})}),insert:e=>({select:()=>new Promise(resolve=>{insertResolve=resolve})})})};vm.runInContext('supa=mock',ctx);
vm.runInContext(section(script,'let realtimeChannel=', 'const tactic='),ctx);
vm.runInContext(section(script,'async function loadEvents(', 'async function deleteEvent('),ctx);
const run=s=>vm.runInContext(s,ctx);const tick=()=>new Promise(r=>setImmediate(r));
const row=(id,part='前半')=>({id,video_id:'match:'+part,user_name:'Bob',comment:'nice',good_time:10});
(async()=>{
 run('initRealtimeSubscription();initRealtimeSubscription()');assert.equal(channels.length,1);assert.equal(channels[0].filter.filter,'video_id=eq.match:前半');
 channels[0].cb({new:row(1)});channels[0].cb({new:row(1)});assert.equal(flown.length,1);assert.equal(run('events.length'),1);assert(run("echoPlayed.has('1:10')"));
 const loading=run('loadEvents()');channels[0].cb({new:row(2)});queries.shift()({data:[],error:null});await loading;assert.equal(run('events.length'),1);assert.equal(run('events[0].id'),2);
 const posting=run("addEvent('🔥 ナイスプレー','great')");channels[0].cb({new:{...row(3),user_name:'Alice',comment:'great'}});assert.equal(run('realtimeBuffer.length'),1);insertResolve({data:[{id:3}],error:null});await tick();assert(!flown.includes('Alice：great')||flown.filter(x=>x==='Alice：great').length===1);queries.shift()({data:[row(2),{...row(3),user_name:'Alice',comment:'great'}]});await posting;assert.equal(flown.filter(x=>x==='Alice：great').length,1);
 const stale=run('loadEvents()');run("currentPart='後半';initRealtimeSubscription()");channels[0].cb({new:row(4)});queries.shift()({data:[row(4)]});await stale;assert(!run('events.some(e=>e.id===4)'));assert.equal(channels.length,2);assert(removed.length>=1);
 channels[1].status('SUBSCRIBED');assert.equal(queries.length,1);queries.shift()({data:[row(5,'後半')]});await tick();assert.equal(run('events[0].id'),5);
 run('stopRealtimeSubscription()');channels[1].cb({new:row(6,'後半')});assert(!run('events.some(e=>e.id===6)'));
 run('supa=null');const offline=run('loadEvents()');await offline;assert.equal(run('events.length'),0);
 console.log('PASS: syntax; existing voice/video/named ECHO/chart unchanged; subscription reuse; dedup; own-send race; select/receive race; stale callbacks and queries; reconnect reload; cleanup; offline');
})().catch(e=>{console.error(e);process.exit(1)});
