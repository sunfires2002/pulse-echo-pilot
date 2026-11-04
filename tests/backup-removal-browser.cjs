/* Isolated static regression server. No production DB or real posts. */
const {chromium}=require('playwright');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const yt=`window.YT={Player:function(id,o){this.t=0;this.state=2;this.volume=70;this.muted=false;this.v=o.videoId;this.getDuration=()=>1380;this.getCurrentTime=()=>this.t;this.getPlayerState=()=>this.state;this.getVideoData=()=>({video_id:this.v});this.getVolume=()=>this.volume;this.setVolume=v=>this.volume=v;this.isMuted=()=>this.muted;this.mute=()=>this.muted=true;this.unMute=()=>this.muted=false;this.seekTo=t=>this.t=t;this.playVideo=()=>{this.state=1;o.events.onStateChange?.({data:1,target:this})};this.pauseVideo=()=>{this.state=2;o.events.onStateChange?.({data:2,target:this})};this.loadVideoById=v=>{this.v=v;this.t=0;o.events.onStateChange?.({data:2,target:this})};this.destroy=()=>{};document.getElementById(id).innerHTML='<iframe title="YouTube mock"></iframe>';setTimeout(()=>o.events.onReady({target:this}),10)}};window.onYouTubeIframeAPIReady?.();`;
const fixtures=[{id:'removal-test-a',date:'2026-11-04',home:'サンプルA',away:'サンプルB',homeScore:2,awayScore:1,competition:'検証用',published:true,firstHalfVideo:'M7lc1UVf-VE',secondHalfVideo:'aqz-KE-bpKQ'},{id:'removal-test-b',date:'2026-11-03',home:'サンプルC',away:'サンプルD',homeScore:0,awayScore:0,published:true,firstHalfVideo:'M7lc1UVf-VE'}];
const server=http.createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html',file=path.resolve(ROOT,name);
  if(!file.startsWith(ROOT+path.sep)||name.split('/').some(p=>p.startsWith('.'))||! /\.(html|js|css|svg|png|json)$/i.test(name)){res.writeHead(404);res.end();return}
  const body=await fs.readFile(file),ext=path.extname(file),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'}[ext];
  res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end()}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({channel:'chrome',headless:true});let dbRequests=0;const checks=[];
 try{
  for(const [mode,width,height,ua] of [['pc',1920,1080],['tv',1280,720,'Mozilla/5.0 (Linux; Android 9; AFTMM) Silk/123 Chrome/123 Safari/537.36'],['mobile',390,844,'Mozilla/5.0 (Linux; Android 14) Chrome/123 Mobile Safari/537.36'],['tablet',800,1000,'Mozilla/5.0 (Linux; Android 14) Chrome/123 Safari/537.36']]){
   const c=await browser.newContext({viewport:{width,height},...(ua?{userAgent:ua}:{})}),p=await c.newPage();const errors=[];p.on('pageerror',()=>errors.push('page_exception'));
   await c.route('**/*',r=>{const u=new URL(r.request().url());
    if(u.hostname.endsWith('.supabase.co')){dbRequests++;return r.abort()}
    if(u.origin===new URL(base).origin&&u.pathname==='/config.js')return r.fulfill({contentType:'text/javascript',body:'window.PULSE_CONFIG={};'});
    if(u.origin===new URL(base).origin&&u.pathname==='/data.js')return r.fulfill({contentType:'text/javascript',body:'window.PULSE_MATCHES='+JSON.stringify(fixtures)+';'});
    if(u.href==='https://www.youtube.com/iframe_api')return r.fulfill({contentType:'text/javascript',body:yt});
    if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('supabase-js'))return r.fulfill({contentType:'text/javascript',body:'window.supabase={};'});
    if(u.origin===new URL(base).origin||u.hostname==='cdn.jsdelivr.net')return r.continue();
    return r.abort();
   });
   await c.addInitScript(rows=>{localStorage.setItem('pulse_echo_user_name','サンプル');localStorage.setItem('pulse_echo_workflow_v3',JSON.stringify({matches:rows}));localStorage.setItem('pulse_echo_removal-test-a_前半',JSON.stringify([{id:'sample-1',good_time:10,description:'😫 惜しい',user_name:'サンプル',comment:'サンプル反応'}]));},fixtures);
   await p.goto(base+(mode==='tv'?'?mode=tv':''),{waitUntil:'networkidle'});assert.equal(await p.locator('.match-card').count(),2);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await p.locator('.match-card').first().click();await p.waitForFunction(()=>typeof playerReady!=='undefined'&&playerReady&&typeof chart!=='undefined'&&chart);
   assert.equal(await p.evaluate(()=>events.length),1);await p.evaluate(()=>{player.playVideo();player.seekTo(60,true);player.pauseVideo()});assert.equal(await p.evaluate(()=>player.getCurrentTime()),60);
   await p.locator('#tabs .tab').nth(1).evaluate(e=>e.click());await p.waitForFunction(()=>currentPart==='後半');assert.equal(await p.evaluate(()=>player.getVideoData().video_id),'aqz-KE-bpKQ');await p.locator('#tabs .tab').first().evaluate(e=>e.click());await p.waitForFunction(()=>currentPart==='前半'&&events.length===1);
   await p.evaluate(()=>addEvent('😫 惜しい','',12));assert.equal(await p.evaluate(()=>events.length),2);assert((await p.locator('#timeline').textContent()).includes('惜しい'));
   if(mode==='pc'){
    assert.equal(await p.locator('.pc-panel-icon').count(),4);
    const map=await p.locator('#tvMapDock').boundingBox(),grip=await p.locator('#labReactions .lab-panel-grip').boundingBox();await p.mouse.move(grip.x+100,grip.y+15);await p.mouse.down();await p.mouse.move(map.x+150,map.y+map.height-2,{steps:12});await p.mouse.up();assert(await p.locator('#labUndock').isVisible());await p.reload({waitUntil:'networkidle'});await p.waitForFunction(()=>playerReady&&chart);assert(await p.locator('#labUndock').isVisible());await p.locator('#labUndock').click();assert(!await p.locator('#labUndock').isVisible());
   }
   const home=mode==='tv'?p.locator('#tvHome'):p.locator('a.brand');if(await home.isVisible())await home.click();else await p.goto(base,{waitUntil:'networkidle'});await p.waitForSelector('.match-card');assert.equal(await p.locator('.match-card').count(),2);
   if(mode==='tv')assert(await p.locator('.match-card').evaluateAll(a=>a.every(e=>new URL(e.href).searchParams.get('mode')==='tv')));
   assert.equal((await c.request.get(base+'pulse-echo-workflow-backup.json')).status(),404);assert.deepEqual(errors,[]);
   checks.push({mode,width,height,home:true,halfSwitch:true,pulse:true,react:true,localReactionOnly:true,homeRoundtrip:true,backup404:true,...(mode==='pc'?{dockRestoreSplit:true}:{})});await c.close();
  }
  assert.equal(dbRequests,0);console.log(JSON.stringify({passed:true,checks,databaseRequests:dbRequests,productionWrites:0,video:'mock'}));
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e.name+': '+String(e.message).replace(/https?:\/\/[^\s]+/g,'[URL]').slice(0,220));server.close();process.exitCode=1});
