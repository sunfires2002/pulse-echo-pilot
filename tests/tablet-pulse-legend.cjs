// Real Chart.js layout checks; video/data requests are isolated from production.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs/promises');
const path=require('node:path');
const base=process.env.TABLET_TEST_URL||'http://127.0.0.1:8031/';
const out=process.env.TABLET_EVIDENCE_DIR;
assert.ok(out&&['localhost','127.0.0.1'].includes(new URL(base).hostname));
const repo=path.resolve(__dirname,'..');
const baseline=Object.fromEntries(['match.html','style.css','pc-desktop.js'].map(f=>[f,execFileSync('git',['show','6473597:'+f],{cwd:repo,encoding:'utf8'})]));
const android='Mozilla/5.0 (Linux; Android 13; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const ipad='Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const silk='Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 (KHTML, like Gecko) Silk/126.4.13 like Chrome/126.0.6478.186 Safari/537.36';
const specs=[
 {name:'android-1024',width:1024,height:640,ua:android},
 {name:'android-1280',width:1280,height:800,ua:android},
 {name:'android-1280-short',width:1280,height:720,ua:android},
 {name:'ipad-1024',width:1024,height:768,ua:ipad},
 {name:'ipad-1180',width:1180,height:820,ua:ipad},
 {name:'ipad-1366',width:1366,height:1024,ua:ipad},
 {name:'phone-landscape',width:844,height:390,ua:android,hidden:true},
 {name:'pc',width:1280,height:800},
 {name:'silk-tv',width:1280,height:720,ua:silk,mode:'tv'},
 {name:'boundary-1100',width:1100,height:700,ua:android},
 {name:'boundary-1101',width:1101,height:700,ua:android},
 {name:'boundary-height-500',width:1024,height:500,ua:android,hidden:true}
];
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const requests=[],errors=[],results=[];
 async function open(spec,old=false){
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},...(spec.ua?{userAgent:spec.ua,hasTouch:true,isMobile:true}:{}),deviceScaleFactor:1});
  await context.route(/supabase\.(co|com)/,r=>{requests.push(r.request().url());return r.abort()});
  await context.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.PULSE_CONFIG={};'}));
  await context.route('**/iframe_api',r=>r.fulfill({contentType:'application/javascript',body:''}));
  if(old)await context.route(base+'**',r=>{
   const f=new URL(r.request().url()).pathname.slice(new URL(base).pathname.length);
   return baseline[f]?r.fulfill({contentType:f.endsWith('.css')?'text/css':f.endsWith('.js')?'application/javascript':'text/html',body:baseline[f]}):r.fallback();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'match.html?id=sunfires-vs-niceguy-20260607'+(spec.mode?'&mode='+spec.mode:''));
  await page.waitForFunction(()=>typeof chart!=='undefined'&&chart);
  if(!spec.ua||spec.mode)await page.waitForFunction(()=>window.PULSE_PC_READY);
  const skip=page.getByRole('button',{name:'スキップ',exact:true});if(await skip.isVisible())await skip.click();
  await page.evaluate(()=>{events=[{description:'🔥 ナイスプレー',good_time:30,user_name:'sample'},{description:'😫 惜しい',good_time:120,user_name:'sample'},{description:'🤖 AIにお任せ',good_time:180,user_name:'sample'}];draw(events)});
  await page.waitForTimeout(300);return{context,page};
 }
 async function measure(page){return page.evaluate(()=>{
  const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();
  const legend=chart.legend;
  return{clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
   mapVisible:document.querySelector('.heatmap').checkVisibility(),map:rect('.heatmap'),canvas:rect('#chart'),
   plotHeight:chart.chartArea.height,legendBottom:legend.bottom,
   legendBoxes:legend.legendItems.map((item,i)=>({text:item.text,...legend.legendHitBoxes[i]})),
   axisBottom:chart.scales.x.bottom,chartHeight:chart.height,
   geometry:['#videoShell','.controls','.mobile-panel-tabs','.side-stack'].map(s=>({selector:s,rect:rect(s),display:getComputedStyle(document.querySelector(s)).display})),
   storage:localStorage.getItem('pulse_echo_pc_lab_layout_v1')};
 })}
 function assertTablet(m){
  assert.ok(m.mapVisible);assert.ok(m.scrollWidth<=m.clientWidth+1,'horizontal overflow');
  assert.ok(m.map.right<=m.clientWidth+1&&m.map.left>=-1,'panel outside page');
  assert.equal(Math.round(m.canvas.height),220);assert.ok(m.plotHeight>100,'insufficient plot area');
  const last=m.legendBoxes.at(-1);assert.ok(last.text.includes('その他'));
  for(const label of m.legendBoxes)assert.ok(label.top+label.height<=m.legendBottom+.1,'legend clipped: '+label.text);
  assert.ok(m.axisBottom<=m.chartHeight+.1,'x axis clipped');
 }
 for(const spec of specs){
  const {context,page}=await open(spec);const m=await measure(page);
  if(spec.hidden){assert.equal(m.mapVisible,false);assert.ok(m.scrollWidth<=m.clientWidth+1)}
  else if(spec.ua&&!spec.mode)assertTablet(m);
  if(spec.hidden||spec.mode||!spec.ua){
   const prior=await open(spec,true);const old=await measure(prior.page);
   // TV chart contents intentionally changed to seconds; compare its layout here.
   if(spec.mode){for(const key of ['clientWidth','scrollWidth','map','canvas','geometry','storage'])assert.deepEqual(m[key],old[key],spec.name+' '+key+' layout changed')}
   else assert.deepEqual(m,old,spec.name+' existing layout changed');
   await prior.context.close();
  }
  if(m.mapVisible){await page.locator('.heatmap').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,spec.name+'.png')});await page.locator('.heatmap').screenshot({path:path.join(out,spec.name+'-panel.png')});}
  else await page.screenshot({path:path.join(out,spec.name+'.png')});
  results.push({name:spec.name,viewport:{width:spec.width,height:spec.height},...m});await context.close();console.log('PASS',spec.name);
 }
 // Confirm the old failure so this test cannot silently validate the wrong page.
 const prior=await open(specs[1],true),old=await measure(prior.page);
 assert.equal(old.canvas.height,120);assert.ok(old.legendBoxes.at(-1).top+old.legendBoxes.at(-1).height>old.legendBottom);
 await prior.page.locator('.heatmap').screenshot({path:path.join(out,'before-panel.png')});await prior.context.close();
 for(const spec of [{name:'rotate-android',ua:android,sizes:[[800,1280],[1280,800],[800,1280]]},{name:'rotate-ipad',ua:ipad,sizes:[[768,1024],[1024,768],[768,1024]]},{name:'rotate-ipad-pro',ua:ipad,sizes:[[1024,1366],[1366,1024],[1024,1366]]}]){
  const {context,page}=await open({width:spec.sizes[0][0],height:spec.sizes[0][1],ua:spec.ua});const steps=[];
  for(let i=0;i<spec.sizes.length;i++){
   const [width,height]=spec.sizes[i];await page.setViewportSize({width,height});await page.waitForTimeout(600);
   const m=await measure(page);assertTablet(m);steps.push({width,height,...m});
   await page.locator('.heatmap').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,spec.name+'-'+i+'.png')});
  }
  results.push({name:spec.name,steps});await context.close();console.log('PASS',spec.name);
 }
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(out,'results.json'),JSON.stringify({results,requests,errors,baselineFailure:old},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
