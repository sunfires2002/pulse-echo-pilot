/* Chrome UI with in-memory services: no microphone or external posts. */
const {chromium}=require('/Users/momo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert'),fs=require('fs');
const base='http://127.0.0.1:8767/match.html?id=team-room-test-20261011-shared&team=sunfires';
const supabase=`window.supabase={createClient:()=>({channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){},from:()=>({select:()=>({eq:()=>({order:async()=>({data:[]})})}),insert(){throw Error('Posting is not part of this test')}})})}`;
const yt=`window.playerCreates=0;window.YT={Player:function(id,opts){playerCreates++;this.time=321;this.playing=true;this.getCurrentTime=()=>this.time;this.getDuration=()=>1800;this.seekTo=t=>this.time=t;this.playVideo=()=>this.playing=true;this.pauseVideo=()=>this.playing=false;this.loadVideoById=()=>{};document.getElementById(id).innerHTML='<iframe title="YouTube mock"></iframe>';setTimeout(()=>opts.events.onReady(),0);return this}};const timer=setInterval(()=>{if(window.onYouTubeIframeAPIReady){clearInterval(timer);onYouTubeIframeAPIReady()}},20);`;
async function fit(p,id){await p.waitForFunction(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return r.width>0&&r.x>=7&&r.y>=7&&r.right<=innerWidth-7&&r.bottom<=innerHeight-7},id);const r=await p.locator(id).boundingBox(),v=p.viewportSize();assert(r&&r.x>=7&&r.y>=7&&r.x+r.width<=v.width-7&&r.y+r.height<=v.height-7,JSON.stringify({id,r,v}))}
async function drag(p,x,y){const r=await p.locator('#labMenuToggle').boundingBox();await p.mouse.move(r.x+40,r.y+r.height/2);await p.mouse.down();await p.mouse.move(x,y,{steps:10});await p.mouse.up()}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 for(const viewport of [{width:1920,height:1080},{width:900,height:600}]){
  const context=await browser.newContext({viewport,userAgent:'Macintosh'}),p=await context.newPage(),errors=[],writes=[];
  p.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*.supabase.co/**',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method()))writes.push(r.request().method());return r.abort()});
  await context.route('**/@supabase/supabase-js@2',r=>r.fulfill({contentType:'application/javascript',body:supabase}));
  await context.route('https://www.youtube.com/iframe_api',r=>r.fulfill({contentType:'application/javascript',body:yt}));
  await context.addInitScript(()=>localStorage.setItem('pulse_echo_workflow_v3',JSON.stringify({matches:[{id:'team-room-test-20261011-shared',published:true,date:'2026-10-11',home:'SUNFIRES',away:'8motion',homeScore:0,awayScore:0,firstHalfVideo:'dSIO3AdVRIs',secondHalfVideo:'mock_second_half'},{id:'fixture-other',published:true,date:'2026-10-01',home:'TEST',away:'8motion',homeScore:0,awayScore:0,firstHalfVideo:'dSIO3AdVRIs'}]})));
await p.goto(base,{waitUntil:'networkidle'});
  assert(await p.locator('#labMenuToggle img').evaluate(e=>e.complete&&e.naturalWidth>0));
  assert(!await p.locator('#labControls').isVisible());assert(!await p.locator('#labClearAll').isVisible());
  await p.locator('#labMenuToggle').click();assert(await p.locator('#labControls').isVisible());
  assert.deepEqual(await p.locator('#labControls h2').allTextContents(),['鑑賞モード','表示・設定']);
  assert.equal(await p.locator('.pc-menu-modes .btn').count(),3);await fit(p,'#labControls');
  await p.locator('#labMenuToggle').click();await drag(p,viewport.width-100,viewport.height-50);
  assert(!await p.locator('#labControls').isVisible(),'drag must not open menu');await fit(p,'#labMenuToggle');
  const saved=JSON.parse(await p.evaluate(()=>localStorage.getItem('pulse_echo_pc_menu_v1')));
  await p.reload({waitUntil:'networkidle'});const restored=await p.locator('#pcPulseMenu').boundingBox();assert(Math.abs(restored.x-saved.left)<1&&Math.abs(restored.y-saved.top)<1);
  await p.locator('#labMenuToggle').click();await fit(p,'#labControls');
  await drag(p,viewport.width/2,viewport.height/2);assert(await p.locator('#labControls').isVisible(),'drag must not close menu');await fit(p,'#labControls');
  await p.locator('#labMenuToggle').click();assert(!await p.locator('#labControls').isVisible());
  // Keyboard click remains independent from pointer dragging; keyboard movement is opt-in.
  await p.locator('#labMenuToggle').press('Enter');assert(await p.locator('#labControls').isVisible());await p.locator('#labMenuToggle').press('Alt+ArrowLeft');assert(await p.locator('#labControls').isVisible());
  assert.equal(await p.locator('#labPosting .lab-panel-grip').innerText(),'ECHO投稿 ─ 移動');
  assert.equal(await p.locator('.pc-menu-visibility button').filter({hasText:'ECHO投稿'}).count(),1);
  assert(!await p.locator('#pcOpacitySettings').evaluate(e=>e.open));
  assert.equal(await p.locator('#pcOpacitySettings input[type=range]').count(),4);
  const values={'labPosting':'64','labTimeline':'86','map':'90','labReactions':'55'};
  await p.locator('#pcOpacitySettings summary').click();
  for(const [id,value]of Object.entries(values))await p.locator('#labOpacity-'+id).fill(value);
  const storedOpacity=await p.evaluate(()=>localStorage.getItem('pulse_echo_pc_lab_layout_v1'));
  for(let n=0;n<4;n++)await p.locator('#pcOpacitySettings summary').click();
  assert.equal(await p.evaluate(()=>localStorage.getItem('pulse_echo_pc_lab_layout_v1')),storedOpacity);
  await p.locator('#pcOpacitySettings summary').click();assert(!await p.locator('#labOpacity-map').isVisible());
  await p.reload({waitUntil:'networkidle'});await p.locator('#labMenuToggle').click();
  assert(!await p.locator('#pcOpacitySettings').evaluate(e=>e.open));
  for(const [id,value]of Object.entries(values)){
   assert.equal(await p.locator('#labOpacity-'+id).inputValue(),value);
   const panel=id==='map'?'tvMapDock':id;
   assert(Math.abs(await p.locator('#'+panel).evaluate(e=>Number(e.style.getPropertyValue('--lab-bg-alpha')))-(100-Number(value))/100)<.0001);
  }
  await p.locator('#pcOpacitySettings summary').click();
  for(const [id,value]of Object.entries(values))assert.equal(await p.locator('#labOpacity-'+id).inputValue(),value);
  await p.locator('.pc-menu-visibility button').filter({hasText:'タイムライン'}).click();assert(!await p.locator('#labTimeline').isVisible());
  const oldLayout=await p.evaluate(()=>localStorage.getItem('pulse_echo_pc_lab_layout_v1'));
  await p.evaluate(()=>{window.originalPlayer=player;window.originalChannel=realtimeChannel;window.originalFrame=document.querySelector('#player iframe')});
  await p.locator('#labClearAll').click();assert(await p.locator('body').evaluate(e=>e.classList.contains('lab-clean')));assert(await p.locator('#labMenuToggle').isVisible());assert(!await p.locator('#labControls').isVisible());
  for(const id of ['#labPosting','#tvMapDock','#labReactions','#labTimeline'])assert(!await p.locator(id).isVisible());
  await p.locator('#labMenuToggle').click();await p.locator('#pcViewing').click();assert(!await p.locator('body').evaluate(e=>e.classList.contains('lab-clean')));assert(!await p.locator('#labTimeline').isVisible());assert(await p.locator('#tvMapDock').isVisible());assert.equal(await p.evaluate(()=>localStorage.getItem('pulse_echo_pc_lab_layout_v1')),oldLayout);
  await p.locator('#labMenuToggle').click();await p.locator('#labToTv').click();assert(!await p.locator('#pcPulseMenu').isVisible());assert(await p.locator('#labReturn').isVisible());await p.locator('#labReturn').click();
  assert(await p.evaluate(()=>player===originalPlayer&&realtimeChannel===originalChannel&&document.querySelector('#player iframe')===originalFrame&&playerCreates===1&&player.time===321&&player.playing));
  for(const size of [{width:480,height:350},{width:1920,height:1080}]){await p.setViewportSize(size);await fit(p,'#labMenuToggle');await p.locator('#labMenuToggle').click();await fit(p,'#labControls');assert(await p.locator('#labControls').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await p.locator('#labMenuToggle').click()}
  await p.setViewportSize(viewport);await p.locator('#labMenuToggle').click();await p.locator('#labReset').click();assert(await p.locator('#labTimeline').isVisible());assert.equal(await p.locator('#labOpacity-map').inputValue(),'78');assert.equal(await p.locator('#labOpacity-labTimeline').inputValue(),'72');const reset=JSON.parse(await p.evaluate(()=>localStorage.getItem('pulse_echo_pc_menu_v1')));assert.deepEqual(reset,{version:1,left:8,top:8});
  await p.screenshot({path:'/private/tmp/pc-pulse-menu-'+viewport.width+'.png'});
  await p.reload({waitUntil:'networkidle'});assert(!await p.locator('#labControls').isVisible());assert(await p.locator('#labTimeline').isVisible());assert(!await p.locator('body').evaluate(e=>e.classList.contains('lab-clean')));
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('PASS PC menu',viewport,'drag/click; persistence; viewport clamps; settings; clean restore; TV roundtrip; same player/channel; no external writes');await context.close();
 }
 await browser.close();
 assert.equal(require('crypto').createHash('sha256').update(fs.readFileSync(require('path').resolve(__dirname,'../assets/pulse-echo-icon.png'))).digest('hex'),'ec4ab6e941dd959ef06d5c716dc19c6818ff3abc3cf95bc7c5479ed6fceafa6d');
})().catch(e=>{console.error(e);process.exit(1)});
