const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fixed = process.env.ECHO_LAB_URL || 'http://127.0.0.1:8078/';
const before = process.env.ECHO_BEFORE_URL || 'http://127.0.0.1:8077/';
const out = process.env.ECHO_LAB_OUT;
assert(out);
(async () => {
  await fs.mkdir(out, {recursive:true});
  const browser = await chromium.launch({channel:'chrome', headless:true});
  const results = [], http = [], ws = [], errors = [];
  async function open(base, width, height, flag) {
    const context = await browser.newContext({viewport:{width,height}});
    await context.addInitScript(() => {
      localStorage.setItem('pulse_echo_user_name','SCROLL SAMPLE');
      localStorage.setItem('pulse_echo_sender_id','p_0123456789abcdef0123456789abcdef');
      localStorage.setItem('unrelated-sentinel','keep');
    });
    await context.route('**/iframe_api',r=>r.fulfill({body:''}));
    await context.route(/supabase\.(co|com)/,r=>{http.push(r.request().url());return r.abort()});
    await context.routeWebSocket(/supabase\.(co|com)/,s=>{ws.push(s.url());s.close()});
    const page = await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}match.html?id=echo-options-sample&echoOptionsLab=${flag}`);
    await page.waitForFunction(()=>window.PULSE_PC_READY);
    await page.evaluate(()=>{
      player={getCurrentTime:()=>130,getDuration:()=>1641,getPlayerState:()=>2,getVideoData:()=>({video_id:'dSIO3AdVRIs'}),seekTo(){},playVideo(){}};playerReady=true;
    });
    return {context,page};
  }
  const measure = p => p.evaluate(()=>{
    const panel=document.querySelector('#labReactions'), content=panel.querySelector('.lab-panel-content'), grip=panel.querySelector('.lab-panel-grip'), source=panel.querySelector('.lab-reaction-source');
    const detail=e=>({rect:e.getBoundingClientRect().toJSON(),clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,padding:getComputedStyle(e).padding,overflow:getComputedStyle(e).overflowY});
    const savedScroll=content.scrollTop;content.scrollTop=1e6;const maxScroll=content.scrollTop;content.scrollTop=savedScroll;
    return {maxScroll,panel:detail(panel),grip:detail(grip),content:detail(content),source:detail(source),buttons:[...source.querySelectorAll('.react')].filter(e=>e.checkVisibility()).map(e=>({text:e.textContent,rect:e.getBoundingClientRect().toJSON()})),protected:['#videoShell','#tvMapDock','#labPosting','#labTimeline'].map(s=>detail(document.querySelector(s)).rect)};
  });
  function noScroll(m) {assert.equal(m.maxScroll,0);assert(m.content.scrollHeight<=m.content.clientHeight);assert(m.content.scrollWidth<=m.content.clientWidth)}
  for (const [width,height] of [[1280,720],[1920,1080],[2500,928]]) for (const flag of [0,1]) {
    const label=`${width}-${flag?'options':'existing'}`;
    const old=await open(before,width,height,flag), original=await measure(old.page);
    assert(original.content.scrollHeight>original.content.clientHeight);
    await old.page.screenshot({path:`${out}/${label}-before.png`});
    await old.page.locator('#labReactions').screenshot({path:`${out}/${label}-before-echo.png`});
    await old.context.close();
    const {context,page:p}=await open(fixed,width,height,flag), current=await measure(p);
    noScroll(current);assert.equal(current.panel.rect.height,114);
    assert.deepEqual(current.buttons,original.buttons);assert.deepEqual(current.protected,original.protected);
    await p.screenshot({path:`${out}/${label}-after.png`});
    await p.locator('#labReactions').screenshot({path:`${out}/${label}-after-echo.png`});
    // Actual grip movement and all four viewport corners preserve the content fit.
    const grip=p.locator('#labReactions .lab-panel-grip');await grip.focus();
    for (const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']) await p.keyboard.press(key);
    noScroll(await measure(p));
    for(const [left,top] of [[8,8],[width-728,8],[8,height-122],[width-728,height-122]]){
      await p.evaluate(({left,top})=>Object.assign(document.querySelector('#labReactions').style,{left:left+'px',top:top+'px'}),{left,top});
      const m=await measure(p);noScroll(m);assert(m.panel.rect.bottom<=height-8);
      if(flag){await p.locator('#niceButton').click();await p.waitForTimeout(80);noScroll(await measure(p));await p.locator('.echo-lab-close').click()}
    }
    // Narrow saved/manual bounds still allow real overflow; no blanket hidden.
    await p.evaluate(()=>Object.assign(document.querySelector('#labReactions').style,{left:'8px',top:'8px',width:'420px'}));
    const narrow=await measure(p);assert(narrow.content.scrollHeight>narrow.content.clientHeight);assert.equal(narrow.content.overflow,'auto');
    await p.locator('#labReactions .react.respect').click();
    if(flag){await p.locator('.echo-lab-close').click();await p.locator('#niceButton').click();await p.waitForTimeout(80);noScroll(await measure(p));await p.screenshot({path:`${out}/${label}-narrow-open.png`});await p.locator('.echo-lab-close').click()}
    assert.equal(await p.evaluate(()=>events.at(-1).description),flag?'🔥 ナイスプレー':'😳 マジで');
    const snapshot=await p.evaluate(()=>({layout:localStorage.getItem('pulse_echo_pc_lab_layout_v1'),sender:PULSE_PROFILE.senderId(),other:localStorage.getItem('unrelated-sentinel')}));
    await p.reload();await p.waitForFunction(()=>window.PULSE_PC_READY);noScroll(await measure(p));
    assert.deepEqual(await p.evaluate(()=>({layout:localStorage.getItem('pulse_echo_pc_lab_layout_v1'),sender:PULSE_PROFILE.senderId(),other:localStorage.getItem('unrelated-sentinel')})),snapshot);
    // Dock at original dimensions, resize the shared PULSE, restore, then split.
    const map=await p.locator('#tvMapDock').boundingBox(),g=await grip.boundingBox();
    await p.mouse.move(g.x+g.width-20,g.y+15);await p.mouse.down();await p.mouse.move(map.x+150,map.y+map.height-2,{steps:12});await p.mouse.up();
    await p.locator('#labUndock').waitFor();noScroll(await measure(p));
    const resize=await p.locator('#labMapResize').boundingBox();await p.mouse.move(resize.x+10,resize.y+10);await p.mouse.down();await p.mouse.move(resize.x-110,resize.y+10,{steps:10});await p.mouse.up();
    const dockSaved=await p.evaluate(()=>localStorage.getItem('pulse_echo_pc_lab_layout_v1'));
    await p.reload();await p.waitForFunction(()=>window.PULSE_PC_READY);await p.locator('#labUndock').waitFor();noScroll(await measure(p));
    assert.equal(await p.evaluate(()=>localStorage.getItem('pulse_echo_pc_lab_layout_v1')),dockSaved);
    await p.locator('#labUndock').click();noScroll(await measure(p));
    await context.close();results.push({width,height,flag,before:original,after:current,narrow,restoreDockResizeSplit:true});console.log('PASS scrollbar',label);
  }
  assert.deepEqual(http,[]);assert.deepEqual(ws,[]);assert.deepEqual(errors,[]);
  await fs.writeFile(`${out}/results.json`,JSON.stringify({results,http,ws,errors},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
