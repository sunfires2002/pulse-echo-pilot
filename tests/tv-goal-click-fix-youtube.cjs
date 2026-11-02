// Actual YouTube timing. Deliberate holds across a new eligible GOAL, not field incidence.
const{chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
const base=process.env.GOAL_FIX_URL||'http://127.0.0.1:8069/',out=process.env.GOAL_DIAG_OUT;assert(out);
(async()=>{
 await fs.mkdir(out,{recursive:true});const b=await chromium.launch({channel:'chrome',headless:true}),results=[],http=[],ws=[],errors=[];
 for(const variant of ['a','b']){
  const c=await b.newContext({viewport:{width:960,height:540},userAgent:'Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 (KHTML, like Gecko) Silk/126.4.13 like Chrome/126.0.6478.186 Safari/537.36'});
  await c.addInitScript({path:require('node:path').resolve(__dirname,'helpers/tv-goal-diagnostics.js')});
  await c.route('**/config.js',r=>r.fulfill({body:'window.PULSE_CONFIG={};'}));await c.route('**/data.js',r=>r.fulfill({body:'window.PULSE_MATCHES=[{id:"tv-goal-a",home:"GOAL A",away:"SAMPLE",firstHalfVideo:"dSIO3AdVRIs",published:true},{id:"tv-goal-b",home:"GOAL B",away:"SAMPLE",firstHalfVideo:"dSIO3AdVRIs",published:true}];'}));await c.route('**/__goal_diag__',r=>r.fulfill({status:204}));
  await c.addInitScript(()=>localStorage.setItem('pulse_echo_user_name','DIAG SAMPLE'));await c.route(/supabase\.(co|com)/,r=>{http.push(r.request().url());return r.abort()});await c.routeWebSocket(/supabase\.(co|com)/,s=>{ws.push(s.url());s.close()});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+`match.html?id=tv-goal-${variant}&mode=tv&goalLab=1&goalDiag=1`);await p.waitForFunction(()=>window.PULSE_PC_READY&&playerReady&&typeof player?.getPlayerState==='function'&&PULSE_TV_AXIS.duration()>0,null,{timeout:60000});
  const target=variant==='a'?110.5:110,selector=`.tv-goal-ball[data-sec="${variant==='a'?120.5:120}"]`;
  async function prepare(sec,playing=false){await p.evaluate(sec=>{player.seekTo(sec,true);player.playVideo()},sec);await p.waitForFunction(sec=>playerReady&&player.getPlayerState?.()===1&&Math.abs(player.getCurrentTime()-sec)<2,sec,{timeout:30000});if(!playing){await p.evaluate(()=>player.pauseVideo());await p.waitForFunction(()=>playerReady&&player.getPlayerState?.()===2)}await p.locator(selector).waitFor();await p.waitForTimeout(250)}
  const stable=[];
  for(const playing of [false,true])for(let i=0;i<3;i++){
   await prepare(130,playing);if(i%2)await p.locator(selector).focus();else await p.locator('#tvReactToggle').focus();const start=await p.evaluate(()=>PULSE_GOAL_DIAG.rows.length);await p.locator(selector).click();await p.waitForFunction(t=>playerReady&&player.getPlayerState?.()===1&&Math.abs(player.getCurrentTime()-t)<2,target,{timeout:30000});await p.waitForTimeout(150);
   const trace=await p.evaluate(start=>PULSE_GOAL_DIAG.export().slice(start),start);assert.equal(trace.filter(r=>r.type==='goal.click').length,1);assert.equal(trace.filter(r=>r.type==='seek.call'&&r.target===target).length,1);assert(trace.some(r=>r.type==='seek.applied'&&r.target===target));stable.push({playing,focused:!!(i%2),trace});
  }
  const races=[];
  for(let i=0;i<2;i++){
   await prepare(299.1);const old=await p.locator(selector).elementHandle(),box=await old.boundingBox();const start=await p.evaluate(()=>PULSE_GOAL_DIAG.rows.length);await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.evaluate(()=>player.playVideo());await p.waitForFunction(()=>playerReady&&player.getCurrentTime?.()>=300,null,{timeout:15000});await p.locator('.tv-goal-ball[data-sec="300"]').waitFor();assert.ok(await old.evaluate(e=>e.isConnected));await p.mouse.up();await p.waitForFunction(t=>playerReady&&player.getPlayerState?.()===1&&Math.abs(player.getCurrentTime()-t)<2,target,{timeout:30000});await p.waitForTimeout(150);const trace=await p.evaluate(start=>PULSE_GOAL_DIAG.export().slice(start),start);assert.equal(trace.filter(r=>r.type==='goal.click').length,1);assert.equal(trace.filter(r=>r.type==='seek.call'&&r.target===target).length,1);assert(trace.some(r=>r.type==='seek.applied'&&r.target===target));const first=trace;if(i===0)await p.screenshot({path:`${out}/${variant}-first-click-fixed.png`});races.push({first,trace,actual:await p.evaluate(()=>player.getCurrentTime())});
  }
  results.push({variant,stable,races,attempt:await p.evaluate(()=>playerAttempt)});await c.close();console.log('PASS real YouTube click fix',variant);
 }
 assert.deepEqual(http,[]);assert.deepEqual(ws,[]);assert.deepEqual(errors,[]);await fs.writeFile(out+'/results.json',JSON.stringify({controlledHolds:true,results,http,ws,errors},null,2));await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
