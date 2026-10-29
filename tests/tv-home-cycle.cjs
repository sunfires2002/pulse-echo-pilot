// Home navigation only. The player API is blocked; playback has a separate test.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
const base=process.env.HOME_TEST_URL||'http://127.0.0.1:8032/',out=process.env.HOME_EVIDENCE_DIR;
const publicData=process.env.REAL_PUBLIC_DATA==='1',url=new URL(base);
assert.ok(out&&(['localhost','127.0.0.1'].includes(url.hostname)||(publicData&&url.origin==='https://sunfires2002.github.io'&&url.pathname==='/pulse-echo-pilot/')));
(async()=>{
 await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:720},userAgent:'Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 (KHTML, like Gecko) Silk/126.4.13 like Chrome/126.0.6478.186 Safari/537.36'});
 const mutations=[],reads=[],errors=[];
 await context.route(/supabase\.(co|com)/,r=>{const request=r.request();if(publicData&&request.method()==='GET'){reads.push(new URL(request.url()).pathname);return r.continue()}mutations.push(request.method());return r.abort()});
 await context.routeWebSocket(/supabase\.(co|com)/,socket=>socket.close());
 await context.route('**/iframe_api',r=>r.fulfill({contentType:'application/javascript',body:''}));
 if(!publicData){
  await context.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.PULSE_CONFIG={};'}));
  await context.route('**/data.js',r=>r.fulfill({contentType:'application/javascript',body:'window.PULSE_MATCHES=[{id:"sample-a",home:"SAMPLE A",away:"SAMPLE B",firstHalfVideo:"dSIO3AdVRIs",published:true},{id:"sample-b",home:"SAMPLE C",away:"SAMPLE D",firstHalfVideo:"Mx5IiSYW7T8",published:true}];'}));
 }
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 async function home(tv){await page.goto(base+(tv?'?mode=tv':''));await page.waitForFunction(()=>document.querySelectorAll('a.match-card').length>=2)}
 async function tvReady(){await page.waitForFunction(()=>window.PULSE_PC_READY&&document.body.classList.contains('tv-mode'));const skip=page.getByRole('button',{name:'スキップ',exact:true});if(await skip.isVisible())await skip.click();assert.equal(new URL(page.url()).searchParams.get('mode'),'tv');assert.equal(await page.locator('#tvHome').getAttribute('href'),'./?mode=tv')}
 await home(true);const links=await page.locator('a.match-card').evaluateAll(es=>es.slice(0,2).map(e=>e.getAttribute('href')));
 assert.ok(links.every(x=>new URL(x,base).searchParams.get('mode')==='tv'));
 await page.locator('a.match-card').nth(0).click();await tvReady();const a=page.url();await page.locator('#tvHome').click();assert.equal(new URL(page.url()).searchParams.get('mode'),'tv');await page.waitForSelector('a.match-card');
 await page.screenshot({path:out+'/tv-home.png'});await page.locator('a.match-card').nth(0).click();await tvReady();assert.equal(page.url(),a);
 await page.locator('#tvHome').click();await page.waitForSelector('a.match-card');await page.locator('a.match-card').nth(1).click();await tvReady();const b=page.url();assert.notEqual(new URL(b).searchParams.get('id'),new URL(a).searchParams.get('id'));
 await home(false);assert.ok((await page.locator('a.match-card').evaluateAll(es=>es.map(e=>e.getAttribute('href')))).every(x=>!new URL(x,base).searchParams.has('mode')));
 await page.locator('a.match-card').nth(0).click();await page.waitForFunction(()=>document.querySelector('#scoreboard .club'));assert.equal(new URL(page.url()).searchParams.has('mode'),false);assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('tv-mode')),false);
 assert.deepEqual(mutations,[]);assert.deepEqual(errors,[]);await fs.writeFile(out+'/home-results.json',JSON.stringify({publicData,a,b,sameMatchRoundTrip:true,differentMatchRoundTrip:true,normalHome:true,reads,mutations,errors},null,2));await browser.close();console.log('PASS TV A-home-A, A-home-B, normal home');
})().catch(e=>{console.error(e);process.exit(1)});
