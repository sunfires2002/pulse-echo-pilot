const{chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.TV_GOAL_URL||'http://127.0.0.1:8076/';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const silk='Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 (KHTML, like Gecko) Silk/126.4.13 like Chrome/126.0.6478.186 Safari/537.36';
const desktop='Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const phone='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const cases=[
 {name:'TV standard',ua:silk,query:'id=tv-layout-demo&mode=tv',enabled:false,pcReady:true},
 {name:'TV opt-in',ua:silk,query:'id=tv-goal-a&mode=tv&goalLab=1',enabled:true,pcReady:true},
 {name:'TV opt-in with GOAL CSS failure',ua:silk,query:'id=tv-goal-a&mode=tv&goalLab=1',enabled:true,pcReady:true,failure:'css'},
 {name:'TV opt-in with GOAL JS failure',ua:silk,query:'id=tv-goal-a&mode=tv&goalLab=1',enabled:true,pcReady:true,failure:'js'},
 {name:'PC standard with stray flag',ua:desktop,query:'id=tv-layout-demo&goalLab=1',enabled:false,pcReady:true},
 {name:'phone standard with stray flag',ua:phone,query:'id=tv-layout-demo&goalLab=1',enabled:false,pcReady:false},
];
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const spec of cases){
  const context=await browser.newContext({viewport:{width:960,height:540},userAgent:spec.ua}),loaded=[];
  await context.route(/supabase\.(co|com)/,route=>route.abort());
  await context.routeWebSocket(/supabase\.(co|com)/,socket=>socket.close());
  await context.route('**/config.js',route=>route.fulfill({body:'window.PULSE_CONFIG={supabaseUrl:'+JSON.stringify(new URL(base).origin)+',supabaseAnonKey:"FIXTURE_ONLY"};',contentType:'application/javascript'}));
  await context.route('**/supabase-js@2*',route=>route.fulfill({body:'',contentType:'application/javascript'}));
  await context.route('**/iframe_api',route=>route.fulfill({body:'',contentType:'application/javascript'}));
  if(spec.failure==='css')await context.route('**/tv-goals.css*',route=>route.fulfill({status:404,body:''}));
  if(spec.failure==='js')await context.route('**/tv-goals.js*',route=>route.fulfill({status:404,body:''}));
  const page=await context.newPage();page.on('request',request=>loaded.push(new URL(request.url()).pathname));
  await page.goto(base+'match.html?'+spec.query,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#scoreboard .club',{state:'attached'});
  if(spec.pcReady)await page.waitForFunction(()=>window.PULSE_PC_READY);
  if(spec.enabled&&!spec.failure){await page.waitForSelector('#tvGoalLayer',{state:'attached'});assert.ok(loaded.some(path=>path.endsWith('/prism-goals-core.js')));assert.ok(loaded.some(path=>path.endsWith('/tv-goals.js')))}
  else if(spec.failure){assert.equal(await page.locator('#tvGoalLayer').count(),0);assert.equal(await page.locator('#tvReactToggle').count(),1);assert.equal(await page.evaluate(()=>window.PULSE_PC_LOAD_ERROR),undefined)}
  else{assert.equal(await page.locator('#tvGoalLayer').count(),0);assert.equal(loaded.some(path=>path.endsWith('/prism-goals-core.js')||path.endsWith('/tv-goals.js')||path.endsWith('/tv-goals.css')),false)}
  await context.close();console.log('PASS GOAL gate '+spec.name);
 }
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
