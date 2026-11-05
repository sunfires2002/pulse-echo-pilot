// Fire TV style REACT focus, toggle, seek and home regression. Uses synthetic data only.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.TV_REACT_TEST_URL||'http://127.0.0.1:8057/';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const silk='Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 (KHTML, like Gecko) Silk/126.4.13 like Chrome/126.0.6478.186 Safari/537.36';

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const network=[];
 try{
  for(const [width,height] of [[960,540],[1280,720]]){
   const context=await browser.newContext({viewport:{width,height},userAgent:silk});
   await context.addInitScript(()=>localStorage.setItem('pulse_echo_user_name','TV LAB SAMPLE'));
   await context.route(/supabase\.(co|com)/,route=>{network.push(route.request().url());return route.abort()});
   await context.routeWebSocket(/supabase\.(co|com)/,socket=>{network.push(socket.url());socket.close()});
   await context.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.PULSE_CONFIG={supabaseUrl:"https://fixture.invalid",supabaseAnonKey:"fixture-only"};'}));

   await context.route('**/supabase-js@2*',route=>route.fulfill({contentType:'application/javascript',body:''}));await context.route('**/rest/v1/rpc/pulse_public_matches_v1*',route=>{const id=new URL(route.request().url()).searchParams.get('requested_id')||'sample';return route.fulfill({contentType:'application/json',body:JSON.stringify([{id,date:'2026-11-05',home:'SAMPLE A',away:'SAMPLE B',firstHalfVideo:'dSIO3AdVRIs',secondHalfVideo:'Mx5IiSYW7T8',published:true}])})});await context.route('**/iframe_api',route=>route.fulfill({contentType:'application/javascript',body:''}));
   const page=await context.newPage();
   await page.goto(base+'match.html?id=react-test&mode=tv');
   await page.waitForFunction(()=>window.PULSE_PC_READY&&document.querySelector('#tvReactToggle'));
   const skip=page.getByRole('button',{name:'スキップ',exact:true});
   if(await skip.isVisible())await skip.click();
   await page.evaluate(()=>{
    window.fake={id:'dSIO3AdVRIs',time:50,state:2,duration:1641,calls:[],getVideoData(){return{video_id:this.id}},getDuration(){return this.duration},getCurrentTime(){return this.time},getPlayerState(){return this.state},seekTo(t){this.calls.push(t);this.time=t},playVideo(){this.state=1},loadVideoById(id){this.id=id;this.time=0;this.state=2}};
    player=fake;playerReady=true;PULSE_TV_AXIS.onReady();
    events=Array.from({length:8},(_,i)=>({id:'r'+i,good_time:i*10,description:'💬',comment:'SAMPLE '+i,user_name:'LOCAL',video_id:'react-test:前半'}));draw(events);
   });
   await page.waitForFunction(()=>PULSE_TV_AXIS.duration()===1641);
   assert.equal(await page.locator('.tv-reactions .tv-react').count(),5);
   assert.ok(await page.locator('#tvHome').isVisible());
   // TV identity is managed on the home screen, not inside the playback toolbar.
   assert.ok((await page.locator('.tv-reactions').evaluate(e=>[...e.children].map(x=>x.id||x.className))).join('|').startsWith('tvHome|tv-reaction-group|tvReactToggle'));

   await page.locator('#tvReactToggle').click();
   const visibleRows=6; // Current playback time is 50 seconds; later rows must stay hidden.
   await page.waitForFunction(count=>document.querySelectorAll('#tvReactItems button').length===count,visibleRows);
   assert.equal(await page.locator('#tvReactToggle').getAttribute('aria-expanded'),'true');
   assert.ok(await page.locator('#tvReactList').isVisible());
   assert.ok(await page.locator('#tvReactItems button').last().evaluate(e=>e===document.activeElement));
   await page.evaluate(()=>{fake.time=20});
   await page.waitForFunction(()=>document.querySelectorAll('#tvReactItems button').length===3);
   assert.ok((await page.locator('#tvReactUntil').innerText()).includes('0:20'));
   await page.evaluate(()=>{fake.time=50});
   await page.waitForFunction(()=>document.querySelectorAll('#tvReactItems button').length===6);
   await page.locator('#tvReactItems button').last().focus();
   await page.keyboard.press('ArrowUp');
   assert.ok(await page.locator('#tvReactItems button').nth(visibleRows-2).evaluate(e=>e===document.activeElement));
   await page.keyboard.press('ArrowDown');
   assert.ok(await page.locator('#tvReactItems button').last().evaluate(e=>e===document.activeElement));
   await page.keyboard.press('ArrowDown');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'tvReactToggle');
   await page.keyboard.press('ArrowUp');
   assert.ok(await page.locator('#tvReactItems button').last().evaluate(e=>e===document.activeElement));

   await page.locator('#tvReactItems button[data-time="30"]').focus();
   await page.keyboard.press('Enter');
   assert.equal(await page.evaluate(()=>fake.calls.at(-1)),30);
   assert.equal(await page.evaluate(()=>fake.state),1);
   await page.locator('#tvReactToggle').focus();
   await page.keyboard.press('Enter');
   assert.ok(await page.locator('#tvReactList').isHidden());
   assert.equal(await page.locator('#tvReactToggle').getAttribute('aria-expanded'),'false');

   await page.locator('#tvHome').focus();
   await page.keyboard.press('Enter');
   await page.waitForURL(/\/?mode=tv$/);
   await page.waitForSelector('.match-card');
   assert.equal(await page.locator('.match-card').count(),1);
   await page.locator('#homeProfileOpen').click();
   await page.locator('#homeProfileInput').fill('LOCAL NAME CHECK');
   await page.locator('#homeProfileSave').click();
   assert.ok((await page.locator('#homeProfileName').innerText()).includes('LOCAL NAME CHECK'));
   assert.deepEqual(network,[]);
   await context.close();
   console.log('PASS Fire TV REACT controls',width+'x'+height);
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
