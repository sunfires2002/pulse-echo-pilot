/* Actual registered match/YouTube/Realtime subscription. All DB writes blocked. */
const {chromium}=require('/Users/momo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),assert=require('assert');
const base=process.env.PULSE_TEST_BASE||'http://127.0.0.1:8767/';
const matchId=process.env.PULSE_LIVE_MATCH||'sunfires-vs-fc明眸会-20260705';
const output=process.env.PULSE_TEST_OUTPUT||'/private/tmp/pulse-pc-release-live';
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true}),p=await b.newPage({viewport:{width:1920,height:1080}}),errors=[],writes=[],subscriptions=[],reads=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.text().includes('[PULSE REALTIME]'))subscriptions.push(m.text())});
 p.on('response',r=>{if(r.url().includes('.supabase.co/rest/v1/'))reads.push({table:new URL(r.url()).pathname.split('/').pop(),status:r.status()})});
 await p.route('**/*.supabase.co/**',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())){writes.push(r.request().method());return r.abort()}return r.continue()});
 await p.goto(new URL('match.html?id='+encodeURIComponent(matchId),base).href,{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.PULSE_PC_READY&&player&&typeof player.getPlayerState==='function'&&typeof player.getPlayerState()==='number',{timeout:25000});
 assert.equal(await p.evaluate(()=>PULSE_PC_VERSION),'1.0.0');assert.equal(await p.evaluate(()=>PULSE_VOICE_DEBUG.enabled),false);
 await p.evaluate(()=>{window.livePlayer=player;window.liveIframe=document.querySelector('#player iframe')});
 const results=[];
 for(const part of ['0','1']){
  if(part==='1'){await p.locator('#labMenuToggle').click();await p.locator('#pcVideoPart').selectOption(part);await p.locator('#labMenuToggle').click()}
  await p.waitForTimeout(1200);if(await p.evaluate(()=>player.getPlayerState())!==1)await p.mouse.click(960,540);
  await p.waitForFunction(()=>player.getPlayerState()===1,{timeout:20000});const start=await p.evaluate(()=>player.getCurrentTime());await p.waitForTimeout(3000);
  const info=await p.evaluate(()=>({part:currentPart,video:player.getVideoData().video_id,time:player.getCurrentTime(),state:player.getPlayerState(),duration:player.getDuration(),samePlayer:player===livePlayer&&document.querySelector('#player iframe')===liveIframe}));
  assert(info.time>start&&info.samePlayer);results.push(info);
 }
 await p.evaluate(()=>player.pauseVideo());await p.waitForFunction(()=>player.getPlayerState()===2);
 const point=await p.evaluate(()=>{const r=document.getElementById('chart').getBoundingClientRect(),a=chart.chartArea;return{x:r.left+(a.left+a.right)/2*r.width/chart.width,y:r.top+r.height*.8}});await p.mouse.click(point.x,point.y);
 await p.waitForFunction(()=>player.getPlayerState()===1&&player.getCurrentTime()>880&&player.getCurrentTime()<905);
 await p.locator('#labMenuToggle').click();await p.locator('#labToTv').click();await p.locator('#labReturn').click();assert(await p.evaluate(()=>player===livePlayer&&document.querySelector('#player iframe')===liveIframe));
 await p.locator('#labMenuToggle').click();await p.screenshot({path:output+'.png'});
 const result={base,matchId,results,subscriptions,reads,errors,writes,version:await p.evaluate(()=>PULSE_PC_VERSION)};
 fs.writeFileSync(output+'.json',JSON.stringify(result,null,2));
 assert(subscriptions.some(s=>s.includes('SUBSCRIBED')));assert(reads.some(r=>r.table==='pulse_matches'&&r.status===200));assert(reads.some(r=>r.table==='futsal_goods'&&r.status===200));assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 console.log('PASS actual registered videos, pause/seek, mode roundtrip, live subscription, DB reads; no posts:',JSON.stringify(result));await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
