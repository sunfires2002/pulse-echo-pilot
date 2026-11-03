// Actual Supabase SDK + intercepted fictional Auth responses; no Supabase traffic.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const out=process.env.ADMIN_RESET_OUT;assert(out);
const base='http://127.0.0.1:8082/admin-password-reset.html';
const origin='https://'+'a'.repeat(20)+'.supabase.co';
const id='00000000-0000-4000-8000-000000000001';
const viewer='00000000-0000-4000-8000-000000000002';
const jwt=(uid,exp=Math.floor(Date.now()/1000)+3600)=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:uid,exp,iat:Math.floor(Date.now()/1000),aud:'authenticated',role:'authenticated'})).toString('base64url'),'LOCAL_FAKE_SIGNATURE'].join('.');
let stage='start';
const link=uid=>base+'#type=recovery&access_token='+jwt(uid)+'&refresh_token=FAKE_REFRESH_LOCAL_ONLY';
(async()=>{
 const sdk=await fs.readFile(path.join(out,'supabase.js'),'utf8');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const cases=[],unexpected=[],errors=[];let requests=0;
 async function setup(options={}){
  const context=await browser.newContext({viewport:{width:800,height:900}});
  const state={uid:options.uid||id,reads:0,updates:0,recover:0,logout:0,failGet:options.failGet||false,failUpdate:options.failUpdate||null,rate:options.rate||false};
  await context.addInitScript(()=>{
   sessionStorage.setItem('pulse_echo_admin_safety_auth_v1','KEEP_ADMIN_SESSION');
   localStorage.setItem('pulse_echo_sender_id','KEEP_SENDER');
  });
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin==='http://127.0.0.1:8082')return route.continue();
   if(url.origin==='https://cdn.jsdelivr.net')return route.fulfill({body:sdk,contentType:'application/javascript'});
   if(url.origin!==origin){unexpected.push('unexpected-host');return route.abort()}
   requests++;let data,code=200;
   if(url.pathname==='/auth/v1/user'&&req.method()==='GET'){
    state.reads++;if(state.failGet){code=401;data={code:'bad_jwt',message:'NOT FOR DISPLAY'}}else data={id:state.uid,aud:'authenticated',role:'authenticated',email:'fictional@lab.invalid'};
   }else if(url.pathname==='/auth/v1/user'&&req.method()==='PUT'){
    state.updates++;assert(Object.keys(req.postDataJSON()).every(k=>['password','code_challenge','code_challenge_method'].includes(k)));assert.equal(req.postDataJSON().password,'FICTIONAL-new-password-ONLY');
    if(state.failUpdate){code=state.failUpdate==='weak_password'?422:401;data={code:state.failUpdate,message:'PRIVATE_ERROR_DO_NOT_DISPLAY'}}else data={id:state.uid,aud:'authenticated',role:'authenticated'};
   }else if(url.pathname==='/auth/v1/recover'&&req.method()==='POST'){
    state.recover++;assert.equal(url.searchParams.get('redirect_to'),base);assert.equal(req.postDataJSON().email,'fictional@lab.invalid');
    code=state.rate?429:200;data=state.rate?{code:'over_email_send_rate_limit',message:'PRIVATE_ERROR_DO_NOT_DISPLAY'}:{};
   }else if(url.pathname==='/auth/v1/logout'&&req.method()==='POST'){
    assert.equal(url.searchParams.get('scope'),'local');state.logout++;code=204;
   }else if(url.pathname==='/auth/v1/token'&&url.searchParams.get('grant_type')==='refresh_token'){
    code=400;data={code:'refresh_token_not_found',message:'PRIVATE_ERROR_DO_NOT_DISPLAY'};
   }else {unexpected.push('non-allowlisted-auth-or-table');return route.abort()}
   return route.fulfill({status:code,headers:{'x-supabase-api-version':'2024-01-01','access-control-expose-headers':'X-Supabase-Api-Version'},contentType:'application/json',body:code===204?'':JSON.stringify(data)});
  });
  await context.routeWebSocket(/.*/,ws=>{unexpected.push('websocket');ws.close()});
  const p=await context.newPage();p.on('pageerror',()=>errors.push('pageerror'));
  return {context,p,state};
 }
 async function status(p,part){stage=part;try{await p.waitForFunction(part=>document.querySelector('#status').textContent.includes(part),part,{timeout:5000})}catch(e){console.error('Static UI status:',await p.locator('#status').innerText());throw e}}
 async function fill(p){await p.locator('#password').fill('FICTIONAL-new-password-ONLY');await p.locator('#confirm').fill('FICTIONAL-new-password-ONLY')}
 async function noLeak(p){
  assert(!await p.evaluate(()=>location.hash||location.search));assert.equal(await p.evaluate(()=>window.PULSE_RECOVERY_INPUT),undefined);
  assert.equal(await p.evaluate(()=>sessionStorage.getItem('pulse_echo_admin_safety_auth_v1')),'KEEP_ADMIN_SESSION');
  assert.equal(await p.evaluate(()=>localStorage.getItem('pulse_echo_sender_id')),'KEEP_SENDER');
  assert.equal(await p.evaluate(()=>Object.keys(localStorage).concat(Object.keys(sessionStorage)).some(k=>k.includes('recovery_memory'))),false);
  assert(!(await p.locator('body').innerText()).includes('PRIVATE_ERROR'));
 }
 let t=await setup();await t.p.goto(base);await status(t.p,'まだ再設定');assert.equal(t.state.reads,0);assert(await t.p.locator('#save').isDisabled());
 await t.p.locator('#email').fill('fictional@lab.invalid');await t.p.locator('#send').click();await status(t.p,'送信要求');assert.equal(t.state.recover,1);assert.equal(t.state.updates,0);await noLeak(t.p);await t.context.close();cases.push('no-link locked; explicit exact redirect; email request only on action');
 for(const uid of [id,viewer]){
  t=await setup({uid});await t.p.goto(link(uid));await status(t.p,'リンクを確認しました');assert.equal(t.state.updates,0);await noLeak(t.p);
  await fill(t.p);await t.p.locator('#confirm').fill('different-password');await t.p.locator('#save').click();await status(t.p,'一致しません');assert.equal(t.state.updates,0);
  await fill(t.p);await t.p.locator('#save').click();await status(t.p,'UUIDは維持');assert.equal(t.state.updates,1);assert.equal(t.state.logout,1);assert(await t.p.locator('#resetSection').isHidden());await noLeak(t.p);
  await t.p.reload();await status(t.p,'まだ再設定');assert(await t.p.locator('#save').isDisabled());await t.context.close();
 }
 cases.push('existing admin and non-admin recovery; mismatch stops save; single update; local logout; reload loses recovery');
 for(const url of [base+'#error=access_denied&error_code=otp_expired&error_description=PRIVATE_ERROR',base+'#type=signup&access_token=fake&refresh_token=fake',base+'?code=fake',base+'#type=recovery&access_token=fake',base+'#type=recovery&access_token=malformed&refresh_token=fake']){
  t=await setup();await t.p.goto(url);await status(t.p,'使用済み');assert.equal(t.state.updates,0);assert(await t.p.locator('#save').isDisabled());await noLeak(t.p);await t.context.close();
 }
 cases.push('used/expired error callback; wrong flow; unsupported code; incomplete/malformed tokens safely rejected and erased');
 t=await setup({failGet:true});await t.p.goto(link(id));await status(t.p,'使用済み');assert.equal(t.state.updates,0);await t.context.close();cases.push('server rejects recovery session; saving remains locked');
 t=await setup();await t.p.goto(base+'#type=recovery&access_token='+jwt(id,1)+'&refresh_token=fake');await status(t.p,'使用済み');assert.equal(t.state.updates,0);await t.context.close();cases.push('expired session/refresh rejection');
 t=await setup();await t.p.goto(link(id));await status(t.p,'リンクを確認しました');t.state.failGet=true;await fill(t.p);await t.p.locator('#save').click();await status(t.p,'使用済み');assert.equal(t.state.updates,0);await t.context.close();cases.push('server revalidates identity immediately before save; expired authorization blocks PUT');
 for(const failUpdate of ['weak_password','bad_jwt']){
  t=await setup({failUpdate});await t.p.goto(link(id));await status(t.p,'リンクを確認しました');await fill(t.p);await t.p.locator('#save').click();await status(t.p,failUpdate==='weak_password'?'条件を満たして':'結果は未確認');assert.equal(t.state.updates,1);assert(!(await t.p.locator('#status').innerText()).includes('保存されました'));await noLeak(t.p);await t.context.close();
 }
 cases.push('weak password actionable; refused/ambiguous save never claims success or retries');
 t=await setup({rate:true});await t.p.goto(base);await status(t.p,'まだ再設定');await t.p.locator('#email').fill('fictional@lab.invalid');await t.p.locator('#send').click();await status(t.p,'回数制限');assert.equal(t.state.recover,1);await t.context.close();cases.push('rate-limit safe message without automatic retry');
 t=await setup();await t.p.goto(link(id));await status(t.p,'リンクを確認しました');
 for(const width of [320,390,800,1440]){
  await t.p.setViewportSize({width,height:900});assert(await t.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await t.p.screenshot({path:path.join(out,`reset-${width}.png`),fullPage:true});
 }
 await fill(t.p);await t.p.locator('#password').dispatchEvent('keydown',{key:'Enter',isComposing:true,keyCode:229});assert.equal(t.state.updates,0);await noLeak(t.p);
 const headers=(await t.p.request.get(base)).headers();assert(headers['content-security-policy'].includes('/auth/v1/'));assert(!headers['content-security-policy'].includes('wss://'));assert.equal(headers['referrer-policy'],'no-referrer');
 const denied=await t.p.request.get('http://127.0.0.1:8082/.admin-lab.private.json');assert.equal(denied.status(),404);
 await t.context.close();cases.push('320/390/800/1440 responsive; IME Enter; recovery-only CSP; no-referrer; private config inaccessible');
 // Invalid or production configuration is rejected before the SDK/network starts.
 for(const cfg of [{mode:'local'}, {mode:'supabase',testProjectRef:'bxailsvrusrbjmbhlpqh',supabaseUrl:'https://bxailsvrusrbjmbhlpqh.supabase.co',publishableKey:'sb_publishable_FAKE_ONLY_LOCAL_TEST'}]){
  t=await setup();await t.context.route('**/admin-lab-config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.PULSE_ADMIN_LAB_CONFIG='+JSON.stringify(cfg)}));
  const before=requests;await t.p.goto(base);await status(t.p,'接続は停止');assert.equal(requests,before);assert(await t.p.locator('#save').isDisabled());await t.context.close();
 }
 cases.push('local/unconfigured/production settings fail closed before Auth requests');
 assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(out,'results.json'),JSON.stringify({passed:true,cases,unexpectedNetworkRequests:0,actualSupabaseRequests:0,pageErrors:0,method:'Chrome, actual Supabase JS SDK, fictional Auth endpoints intercepted; no real account operations'},null,2));
 await browser.close();console.log(JSON.stringify({passed:true,cases:cases.length,actualSupabaseRequests:0,pageErrors:0}));
})().catch(error=>{console.error(JSON.stringify({failed:true,stage,errorType:error.name}));process.exit(1)});
