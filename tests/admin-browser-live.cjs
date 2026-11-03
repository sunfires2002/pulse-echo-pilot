/* User types credentials in a dedicated visible Chrome. No passwords/tokens logged. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {validate}=require('../tools/admin_rls_test.cjs');
const ROOT=path.resolve(__dirname,'..'),OUT=process.env.ADMIN_BROWSER_OUT;
const BASE='http://127.0.0.1:8082/admin.html';
(async()=>{
 assert(OUT);await fs.mkdir(OUT,{recursive:true});
 const privatePath=path.join(ROOT,'.admin-lab.private.json');assert.equal((await fs.stat(privatePath)).mode&0o077,0);
 const cfg=JSON.parse(await fs.readFile(privatePath,'utf8'));
 const productionHostname=new URL((await fs.readFile(path.join(ROOT,'config.js'),'utf8')).match(/supabaseUrl:\s*"([^\"]+)"/)[1]).hostname;
 const target=validate(cfg,productionHostname),nonce=crypto.randomUUID().slice(0,8),home='UI LAB '+nonce,id='ui-lab-'+nonce+'-vs-sample-b-20261103';
 const browser=await chromium.launch({channel:'chrome',headless:false,args:['--no-first-run']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:false});
 let blocked=0,pageErrors=0,posts=0,patches=0,deletes=0,fault='',delay=false;
 const report={passed:false,checks:[],productionRequests:0,cleanup:'not_started',screenshots:[],notTested:['physical Safari/iPhone','natural JWT expiry']};
 report.checks.push=function(...items){console.log('CHECK '+items.join(', '));return Array.prototype.push.apply(this,items)};
 let baseline,created=false,stage='startup';
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();
  if(url.origin==='http://127.0.0.1:8082')return route.continue();
  if(url.origin==='https://cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2')return route.continue();
  if(url.origin!==target){blocked++;return route.abort()}
  if(!['/auth/v1/token','/auth/v1/user','/auth/v1/logout','/rest/v1/pulse_matches'].includes(url.pathname)){blocked++;return route.abort()}
  if(url.pathname==='/rest/v1/pulse_matches'){
   if(['POST','PATCH','DELETE'].includes(method)){
    let data;try{data=req.postDataJSON()}catch{}
    if((method==='POST'&&data?.id!==id)||(method!=='POST'&&url.searchParams.get('id')!=='eq.'+id)||(data?.data&&data.data.id!==id)){blocked++;return route.abort()}
    if(method==='POST')posts++;if(method==='PATCH')patches++;if(method==='DELETE')deletes++;
    if(fault==='save'&&method==='PATCH'){fault='';return route.fulfill({status:403,contentType:'application/json',headers:{'access-control-allow-origin':'http://127.0.0.1:8082'},body:'{"code":"42501","message":"TEST simulated refusal"}'})}
    if(delay&&method==='PATCH')await new Promise(resolve=>setTimeout(resolve,700));
   }
   if(fault==='load'&&method==='GET'){fault='';return route.fulfill({status:403,contentType:'application/json',body:'{"code":"42501"}'})}
  }
  return route.continue();
 });
 await context.routeWebSocket(/.*/,socket=>{blocked++;socket.close()});
 const p=await context.newPage();p.on('pageerror',()=>pageErrors++);let accept=true;
 p.on('dialog',dialog=>accept?dialog.accept():dialog.dismiss());
 async function label(text){await p.evaluate(text=>{let el=document.getElementById('browserTestNotice');if(!el){el=document.createElement('div');el.id='browserTestNotice';el.style.cssText='position:fixed;top:0;left:0;right:0;z-index:10000;background:#ffe58a;color:#121212;padding:12px;text-align:center;font:700 17px system-ui;';document.body.append(el)}el.textContent=text},text)}
 async function screenshot(name){await p.screenshot({path:path.join(OUT,name+'.png'),fullPage:true,mask:[p.locator('#authIdentity'),p.locator('#authEmail'),p.locator('#authPassword')]});report.screenshots.push(name+'.png')}
 async function status(text){await p.waitForFunction(text=>document.querySelector('#operationStatus').textContent.includes(text),text,{timeout:30000})}
 async function login(role,step){stage='waiting_'+role+'_'+step;console.log('WAIT_'+role.toUpperCase()+'_LOGIN_'+step);await label(role==='admin'?'検証用の管理者でログインしてください。ログイン後は自動テストが進みます。':'検証用の非管理者でログインしてください。ログイン後は自動テストが進みます。');await p.waitForFunction(role=>{const b=window.PULSE_ADMIN_LAB?.backend();return b?.kind==='supabase'&&(role==='admin'?PULSE_ADMIN_LAB.ready():document.querySelector('#operationStatus').textContent.includes('管理権限はありません'))},role,{timeout:600000});await label('検証中：この画面を操作せず、そのままお待ちください。')}
 const state=()=>p.evaluate(()=>PULSE_ADMIN_LAB.snapshot());
 const rows=()=>p.evaluate(async()=>PULSE_ADMIN_LAB.backend().list());
 const selectedRow=async()=> (await rows()).find(r=>r.id===id);
 async function adminPanel(){await p.locator('[data-panel="admin"]').click()}
 async function reload(){await p.locator('#reloadData').click();await p.waitForFunction(()=>PULSE_ADMIN_LAB.ready())}
 async function logout(){await p.locator('#authLogout').click();await p.waitForFunction(()=>document.querySelector('#authIdentity').textContent==='未ログイン');assert(await p.locator('#workflowFields').evaluate(el=>el.disabled));assert.equal((await state()).matches.length,0)}
 try{
  await p.goto(BASE);await p.waitForFunction(()=>window.PULSE_ADMIN_LAB?.backend());
  assert(await p.evaluate(({url,ref})=>PULSE_ADMIN_LAB.backend().kind==='supabase'&&PULSE_ADMIN_LAB_CONFIG.supabaseUrl===url&&PULSE_ADMIN_LAB_CONFIG.testProjectRef===ref,{url:cfg.supabaseUrl,ref:cfg.testProjectRef}));
  await login('admin',1);stage='admin_tests';baseline=await rows();report.checks.push('real_admin_login');
  const before=posts+patches+deletes;await reload();assert.equal(posts+patches+deletes,before);report.checks.push('reload_does_not_write');
  await adminPanel();await p.locator('#matchDate').fill('2026-11-03');await p.locator('#home').fill(home);await p.locator('#away').fill('Sample B');await p.locator('#competition').fill('BROWSER TEST fictional');
  created=true;report.cleanup='pending';await p.getByRole('button',{name:'＋ 試合を登録する',exact:true}).click();await status('保存完了');assert.equal(posts,1);assert.equal((await state()).selectedId,id);assert((await selectedRow()).data.published===false);report.checks.push('real_ui_insert_one_fictional_match');
  await p.locator('#editVenue').fill('UI update verified');await p.getByRole('button',{name:'選択中の試合を更新',exact:true}).click();await status('保存完了');assert.equal((await selectedRow()).data.venue,'UI update verified');
  const writes=posts+patches+deletes;await p.reload();await p.waitForFunction(()=>PULSE_ADMIN_LAB.ready());await label('検証中：この画面を操作せず、そのままお待ちください。');assert.equal(posts+patches+deletes,writes);await adminPanel();await p.evaluate(id=>selectMatch(id),id);assert.equal(await p.locator('#editVenue').inputValue(),'UI update verified');report.checks.push('real_ui_update_and_page_reload_restores');
  let n=patches;const saved=await selectedRow();await p.locator('#editHome').fill('');await p.getByRole('button',{name:'選択中の試合を更新',exact:true}).click();await status('必須');assert.equal(patches,n);assert.deepEqual(await selectedRow(),saved);await reload();await adminPanel();report.checks.push('validation_error_no_write');
  fault='save';await p.locator('#editVenue').fill('MUST NOT SAVE');await p.getByRole('button',{name:'選択中の試合を更新',exact:true}).click();await status('保存失敗');assert.equal(await p.locator('#operationStatus').getAttribute('data-kind'),'error');assert.deepEqual(await selectedRow(),saved);report.checks.push('simulated_403_error_display_no_false_success');await reload();await adminPanel();
  n=patches;delay=true;await p.locator('#editVenue').fill('ONE DOUBLE CLICK UPDATE');await p.evaluate(()=>{saveMatchInfo();saveMatchInfo()});await status('保存完了');delay=false;assert.equal(patches,n+1);assert.equal((await selectedRow()).data.venue,'ONE DOUBLE CLICK UPDATE');report.checks.push('double_save_only_one_real_patch');
  stage='load_failure_simulation';fault='load';n=posts+patches+deletes;await p.locator('#reloadData').click();await status('読込失敗');assert(await p.locator('#workflowFields').evaluate(el=>el.disabled));assert.equal(posts+patches+deletes,n);report.checks.push('simulated_load_failure_locks_writes');await reload();
  await screenshot('admin-saved');await logout();report.checks.push('admin_logout_clears_state');
  await login('non_admin',2);stage='non_admin_tests';assert(await p.locator('#workflowFields').evaluate(el=>el.disabled));
  const denied=await p.evaluate(async id=>{try{await PULSE_ADMIN_LAB.backend().insert({id,data:{id}});return false}catch(error){return error.code==='DENIED'}},id);assert(denied);report.checks.push('real_non_admin_login_ui_and_backend_guard_deny');
  // Real RLS denial through the authenticated browser, tokens remain in browser memory.
  const rls=await p.evaluate(async({id})=>{const cfg=PULSE_ADMIN_LAB_CONFIG;const session=JSON.parse(sessionStorage.getItem('pulse_echo_admin_safety_auth_v1'));if(!session?.access_token)return {ok:false};const response=await fetch(cfg.supabaseUrl+'/rest/v1/pulse_matches?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({data:{id,home:'DENIED TEST',published:false}})});let result;try{result=await response.json()}catch{}return {ok:[401,403].includes(response.status)||(response.status===200&&Array.isArray(result)&&result.length===0),status:response.status}}, {id});assert(rls.ok);report.checks.push('real_non_admin_browser_RLS_patch_denied');report.nonAdminRlsStatus=rls.status;
  await screenshot('non-admin-denied');await logout();report.checks.push('non_admin_logout_clears_state');
  await login('admin',3);stage='cleanup';assert.equal((await selectedRow()).data.venue,'ONE DOUBLE CLICK UPDATE');await adminPanel();await p.locator('[data-match-action="delete"][data-match-id="'+id+'"]').click();await status('削除完了');assert.equal((await rows()).some(r=>r.id===id),false);assert.deepEqual(await rows(),baseline);created=false;report.cleanup='removed_verified_existing_rows_unchanged';report.checks.push('real_ui_delete_no_residue_baseline_unchanged');await screenshot('cleanup-complete');await logout();await label('テスト完了：架空試合を削除し、ログアウトしました。');
  report.passed=true;
 }catch(error){
  report.errorType=['TimeoutError','AssertionError'].includes(error?.name)?error.name:'redacted';
  report.failedStage=stage;report.error='BROWSER_CHECK_FAILED_DETAILS_REDACTED';
  if(created){try{if(await p.evaluate(()=>PULSE_ADMIN_LAB.ready())){await p.evaluate(async id=>{const s=PULSE_ADMIN_LAB.snapshot(),m=s.matches.find(m=>m.id===id);if(m)await PULSE_ADMIN_LAB.backend().remove(m,PULSE_ADMIN_LAB.version(id))},id);assert(!(await rows()).some(r=>r.id===id));report.cleanup='removed_after_failure';created=false}}catch{}}
  if(created){report.cleanup='manual_admin_cleanup_required';report.testMatchId=id}
 }finally{
  report.blockedRequests=blocked;report.pageErrors=pageErrors;report.writeRequests={posts,patches,deletes};
  if(blocked||pageErrors)report.passed=false;
  await fs.writeFile(path.join(OUT,'results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  if(!report.passed){try{await label('テスト停止：チャットの結果をご確認ください。認証情報は共有しないでください。')}catch{}}
  try{await p.evaluate(async()=>{await window.PULSE_ADMIN_LAB?.backend()?.signOut()})}catch{}
  // Close dedicated context to discard credentials/sessions; screenshots are masked.
  await context.close();await browser.close();process.exitCode=report.passed?0:1;
 }
})().catch(()=>{console.error('Browser test stopped before execution. Configuration/launch details omitted.');process.exitCode=1});
