/* Real TEST RPC + real YouTube. Fictional source rows contain short URLs.
 * Only public GET RPC is permitted; reactions stay browser-memory-only.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const base=process.env.PRIVACY_URL||'http://127.0.0.1:8085/';
assert.equal(new URL(base).hostname,'127.0.0.1');
const local=new URL(base).port==='8084';
let stage='launch';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const c=await browser.newContext({viewport:{width:1440,height:900}});
  let rpcReads=0,blocked=0,errors=0;
  await c.route(/https:\/\/[^/]*supabase\.(co|com)\//,r=>{
   const q=r.request(),u=new URL(q.url());
   if(q.method()==='GET'&&u.pathname==='/rest/v1/rpc/public_privacy_matches'){rpcReads++;return r.continue()}
   blocked++;return r.abort();
  });
  await c.addInitScript(()=>localStorage.setItem('pulse_echo_user_name','サンプル'));
  const p=await c.newPage();p.on('pageerror',()=>errors++);
  p.on('console',async message=>{if(message.text().includes('[PULSE PLAYER] player error')){const data=await message.args()[1]?.jsonValue().catch(()=>null);if(data)console.log(JSON.stringify({playerErrorCode:data.code,attempt:data.attempt}))}});
  stage='home';await p.goto(base,{waitUntil:'networkidle'});
  assert.equal(await p.locator('.match-card').count(),2);
  stage='match';await p.locator('.match-card').first().click();
  await p.waitForFunction(()=>typeof playerReady!=='undefined'&&playerReady&&typeof player?.getDuration==='function'&&player.getDuration()>0,null,{timeout:60000});
  const expected=['M7lc1UVf-VE','aqz-KE-bpKQ'],parts=[];
  for(let i=0;i<2;i++){
   stage=i?'second_half_switch':'first_half';
   if(i)await p.locator('#tabs .tab').nth(i).evaluate(e=>e.click());
   await p.waitForFunction(id=>typeof playerReady!=='undefined'&&playerReady&&player?.getVideoData?.()?.video_id===id&&player.getDuration()>0,expected[i],{timeout:45000});
   stage=i?'second_half_play':'first_half_play';
   await p.evaluate(()=>player.playVideo());
   await p.waitForFunction(()=>player.getPlayerState()===1,null,{timeout:30000});
   const target=i?25:15;stage=i?'second_half_seek':'first_half_seek';
   await p.evaluate(t=>{player.pauseVideo();player.seekTo(t,true)},target);
   await p.waitForFunction(t=>Math.abs(player.getCurrentTime()-t)<3,target,{timeout:25000});
   const result=await p.evaluate(t=>({ready:playerReady,durationAvailable:player.getDuration()>0,seekError:Math.abs(player.getCurrentTime()-t),chart:!!chart,existingSampleReactions:events.length>0,pcIcons:document.querySelectorAll('.pc-panel-icon').length,publicVideosAreIds:[match.firstHalfVideo,match.secondHalfVideo].every(v=>/^[A-Za-z0-9_-]{11}$/.test(v))}),target);
   assert(result.seekError<3&&result.publicVideosAreIds);parts.push({part:i?'second':'first',...result});
   await p.screenshot({path:path.resolve(__dirname,'../evidence-public-privacy/live-converted-'+(i?'second':'first')+'.png')});
  }
  assert.equal(blocked,0);assert.equal(errors,0);
  const result={passed:true,dataSource:local?'local_short_url_fixtures':'test_supabase_rpc',parts,halfSwitch:true,rpcReads,blockedRequests:blocked,pageErrors:errors,writes:0};
  await fs.writeFile(path.resolve(__dirname,'../evidence-public-privacy/'+(local?'converted-local-browser-results.json':'live-browser-results.json')),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.name+': TEST browser incomplete at '+stage+'; '+String(e.message).replace(/https?:\/\/[^\s]+/g,'[URL]').slice(0,300));process.exitCode=1});
