// Integrated sample preview only. Real YouTube, fictional GOAL/REACT data, no backend.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
const base=process.env.TV_V1_URL,out=process.env.TV_V1_EVIDENCE_DIR;
assert.ok(base&&out&&['127.0.0.1','192.168.0.16'].includes(new URL(base).hostname));
(async()=>{
 await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true}),results=[],http=[],ws=[],errors=[];
 for(const [width,height] of [[960,540],[1280,720],[1920,1080]]){
  const c=await browser.newContext({viewport:{width,height},userAgent:'Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 (KHTML, like Gecko) Silk/126.4.13 like Chrome/126.0.6478.186 Safari/537.36'});
  await c.route(/supabase\.(co|com)/,r=>{http.push(r.request().url());return r.abort()});await c.routeWebSocket(/supabase\.(co|com)/,s=>{ws.push(s.url());s.close()});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'?mode=tv&goalLab=1');await p.locator('#homeProfileOpen').click();assert.equal(await p.locator('#homeProfileOpen').count(),1);assert.equal(await p.locator('#tvHomeProfileOpen').count(),0);
  const sender=await p.evaluate(()=>PULSE_PROFILE.senderId());await p.locator('#homeProfileInput').fill('統合テスト07');await p.locator('#homeProfileSave').click();await p.locator('a.match-card').first().click();
  const seeks=[];
  for(const part of ['a','b']){
   await p.waitForFunction(()=>window.PULSE_PC_READY&&playerReady&&typeof player?.getPlayerState==='function'&&PULSE_TV_AXIS.duration()>0,null,{timeout:60000});
   assert.equal(await p.evaluate(()=>supa),null);assert.equal(await p.locator('#profileSetup').isVisible(),false);assert.equal(await p.evaluate(()=>PULSE_PROFILE.senderId()),sender);assert.equal(await p.evaluate(()=>PULSE_PROFILE.getName()),part==='a'?'統合テスト07':'変更後07');
   assert.equal(new URL(p.url()).searchParams.get('mode'),'tv');assert.equal(new URL(p.url()).searchParams.get('goalLab'),'1');
   await p.evaluate(()=>{const seek=player.seekTo.bind(player);player.seekTo=(sec,a)=>{window.observedGoalSeek=sec;return seek(sec,a)};player.seekTo(130,true);player.playVideo()});
   await p.waitForFunction(()=>playerReady&&player.getPlayerState?.()===1&&Math.abs(player.getCurrentTime()-130)<3,null,{timeout:30000});await p.evaluate(()=>player.pauseVideo());await p.waitForTimeout(400);
   const geometry=()=>p.evaluate(()=>['#videoShell','#tvMapDock','#chart','.tv-reactions'].map(s=>document.querySelector(s).getBoundingClientRect().toJSON()));const before=await geometry();
   await p.locator('#tvReactToggle').click();await p.locator('#tvReactItems button').first().waitFor();assert.equal(await p.locator('#tvReactList').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(8, 10, 16, 0.75)');assert.deepEqual(await geometry(),before);
   assert.ok(await p.locator('#tvReactItems button').evaluateAll(bs=>bs.every(b=>+b.dataset.time<=player.getCurrentTime())));
   const ball=p.locator(part==='a'?'.tv-goal-ball[data-sec="120.5"]':'.tv-goal-ball[data-nos="2,3,4"]');await ball.waitFor();
   if(part==='b')assert.equal(await ball.locator('.count').innerText(),'3');
   const measure=await ball.evaluate(b=>{const hit=b.getBoundingClientRect(),icon=b.querySelector('.ball').getBoundingClientRect(),frame=b.querySelector('.tv-goal-frame').getBoundingClientRect(),r=chart.canvas.getBoundingClientRect();return{hit:[hit.width,hit.height],iconFont:getComputedStyle(b.querySelector('.ball')).fontSize,frame:[frame.width,frame.height],centerError:[frame.x+frame.width/2-icon.x-icon.width/2,frame.y+frame.height/2-icon.y-icon.height/2],axisError:icon.x+icon.width/2-r.left-PULSE_TV_AXIS.secondsToX(+b.dataset.sec)*r.width/chart.width}});
   assert.deepEqual(measure.hit,[36,32]);assert.deepEqual(measure.frame,[26,22]);assert.equal(measure.iconFont,'16px');assert.ok(measure.centerError.every(x=>Math.abs(x)<.1)&&Math.abs(measure.axisError)<.1);
   await ball.hover();await p.screenshot({path:`${out}/${width}-${part}-react-goal.png`});await ball.click();const target=part==='a'?110.5:110;
   assert.equal(await p.evaluate(()=>window.observedGoalSeek),target);assert.equal(await p.locator('#tvGoalMenu').count(),0);
   await p.waitForFunction(t=>playerReady&&player.getPlayerState?.()===1&&Math.abs(player.getCurrentTime()-t)<3,target,{timeout:30000});
   const actual=await p.evaluate(()=>player.getCurrentTime());await p.waitForFunction(()=>[...document.querySelectorAll('.tv-goal-ball')].every(b=>+b.dataset.sec<=player.getCurrentTime()));
   assert.equal(await p.locator('#tvReactList').isVisible(),true);await p.locator('#tvReactItems button[data-time="105"]').click();assert.equal(await p.evaluate(()=>window.observedGoalSeek),105);
   await p.waitForFunction(()=>playerReady&&player.getPlayerState?.()===1&&Math.abs(player.getCurrentTime()-105)<3,null,{timeout:30000});await p.evaluate(()=>player.pauseVideo());
   assert.deepEqual(await geometry(),before);seeks.push({part,target,actual,measure,reactJump:105});
   await p.locator('#tvHome').click();await p.locator('#homeProfileOpen').waitFor();assert.equal(new URL(p.url()).searchParams.get('mode'),'tv');
   if(part==='a'){await p.locator('#homeProfileOpen').click();await p.locator('#homeProfileInput').fill('変更後07');await p.locator('#homeProfileSave').click();await p.screenshot({path:`${out}/${width}-home-profile.png`});await p.locator('a.match-card').nth(1).click()}
  }
  results.push({width,height,seeks,sharedProfileOnly:true,senderPreserved:true,tvHomeToOtherMatch:true});await c.close();console.log('PASS TV V1 live',width);
 }
 assert.deepEqual(http,[]);assert.deepEqual(ws,[]);assert.deepEqual(errors,[]);await fs.writeFile(out+'/results.json',JSON.stringify({results,http,ws,errors,realGoalFootageVerified:false},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
