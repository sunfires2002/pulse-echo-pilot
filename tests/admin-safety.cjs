const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const base=process.env.ADMIN_LAB_URL||'http://127.0.0.1:8081/admin.html';
const out=process.env.ADMIN_LAB_OUT;assert(out);
const DB='pulse_echo_admin_safety_lab_db_v1';
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true,downloadsPath:out+'/downloads'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),external=[],ws=[],errors=[],cases=[];
 await context.addInitScript(()=>{
  if(!localStorage.getItem('safety-sentinels')){for(const key of ['pulse_echo_workflow_v3','pulse_echo_pc_lab_layout_v1','pulse_echo_user_name','pulse_echo_sender_id'])localStorage.setItem(key,'KEEP OLD '+key);localStorage.setItem('safety-sentinels','1')}
 });
 await context.route('**/*',r=>{if(new URL(r.request().url()).origin!==new URL(base).origin){external.push(r.request().url());return r.abort()}return r.continue()});
 await context.routeWebSocket(/.*/,s=>{ws.push(s.url());s.close()});
 let accept=true;
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>accept?d.accept():d.dismiss());
 const snap=()=>p.evaluate(()=>PULSE_ADMIN_LAB.snapshot());
 const rows=()=>p.evaluate(()=>PULSE_ADMIN_LAB.backend().diagnostics.rows());
 const writes=()=>p.evaluate(()=>PULSE_ADMIN_LAB.backend().diagnostics.audit().filter(x=>x.operation!=='select'));
 const ready=()=>p.waitForFunction(()=>window.PULSE_ADMIN_LAB?.ready());
 async function login(page,email='admin@lab.invalid'){
  await page.locator('#authEmail').fill(email);await page.locator('#authPassword').fill('demo-only');await page.locator('#authSubmit').click();
  if(email==='admin@lab.invalid')await page.waitForFunction(()=>PULSE_ADMIN_LAB.ready());else await page.waitForFunction(()=>document.querySelector('#authIdentity').textContent.includes('管理権限なし'));
 }
 async function settled(){await p.waitForFunction(()=>!document.querySelector('#authSubmit').disabled)}
 async function status(text){await p.waitForFunction(text=>document.querySelector('#operationStatus').textContent.includes(text),text)}
 await p.goto(base);await p.waitForFunction(()=>PULSE_ADMIN_LAB?.backend());
 assert(await p.locator('#workflowFields').evaluate(e=>e.disabled));
 assert.equal(await p.evaluate(async()=>{try{await PULSE_ADMIN_LAB.backend().insert({id:'forbidden'});return 'BAD'}catch(e){return e.code}}),'AUTH');
 await login(p,'viewer@lab.invalid');
 assert.equal(await p.evaluate(async()=>{try{await PULSE_ADMIN_LAB.backend().update({id:'admin-lab-a-20261103'},'0');return 'BAD'}catch(e){return e.code}}),'DENIED');
 assert.equal((await rows()).length,2);cases.push('simulated anonymous/non-admin cannot mutate; no claim of real RLS');
 await p.locator('#authLogout').click();await login(p);let n=(await writes()).length;
 await p.evaluate(()=>selectMatch('admin-lab-b-20261103'));await p.evaluate(()=>selectMatch('admin-lab-a-20261103'));assert.equal((await writes()).length,n);
 const initial=await rows();await p.reload();await ready();assert.deepEqual(await rows(),initial);assert.equal((await writes()).length,0);cases.push('selection/reload do not write');
 await p.locator('[data-panel="admin"]').click();let before=await snap(),cloud=await rows();
 await p.locator('#editHome').fill('');await p.getByRole('button',{name:'選択中の試合を更新',exact:true}).click();await status('必須');assert.deepEqual(await snap(),before);assert.deepEqual(await rows(),cloud);
 await p.locator('#editHome').fill('UNSAVED');await p.selectOption('#labMode','save-error');await p.getByRole('button',{name:'選択中の試合を更新',exact:true}).click();await status('保存失敗');await settled();assert.deepEqual(await snap(),before);assert.deepEqual(await rows(),cloud);assert(!(await p.locator('#saveState').innerText()).includes('保存完了'));cases.push('invalid/rejected save never mutates committed state or shows success');
 await p.selectOption('#labMode','success');await p.locator('[data-panel="filmer"]').click();await p.locator('#filmerName').fill('LAB FILMER');accept=false;n=(await writes()).length;await p.getByRole('button',{name:'撮影・素材提出状況を保存',exact:true}).click();await status('キャンセル');assert.deepEqual(await snap(),before);assert.equal((await writes()).length,n);accept=true;
 await p.evaluate(()=>selectMatch('admin-lab-b-20261103'));await p.evaluate(()=>selectMatch('admin-lab-a-20261103'));assert.deepEqual(await rows(),cloud);cases.push('cancelled draft not leaked through later selection');
 await p.locator('#filmerName').fill('LAB FILMER');await p.locator('#sourceFirst').fill('https://example.invalid/first');await p.locator('#sourceSecond').fill('https://example.invalid/second');
 for(const checkbox of await p.locator('#beforeChecks input,#afterChecks input,#filmingAgreement').all())await checkbox.check();
 n=(await writes()).length;await p.getByRole('button',{name:'撮影・素材提出状況を保存',exact:true}).click();await status('保存完了');assert.equal((await writes()).length,n+1);assert.deepEqual((await rows())[1],cloud[1]);
 await p.locator('[data-panel="editor"]').click();before=await snap();await p.locator('#youtubeFirst').fill('https://youtu.be/dSIO3AdVRIs');await p.selectOption('#editingState','done');await p.getByRole('button',{name:'編集状況を保存',exact:true}).click();await status('確認してください');assert.deepEqual(await snap(),before);
 await p.locator('#editorName').fill('LAB EDITOR');await p.locator('#scoreAdded').check();await p.locator('#partsChecked').check();await p.getByRole('button',{name:'編集状況を保存',exact:true}).click();await status('保存完了');
 await p.locator('[data-panel="admin"]').click();n=(await writes()).length;await p.locator('[data-match-action="publish"]').first().click();await status('揃っていません');assert.equal((await writes()).length,n);
 await p.locator('[data-panel="reviewer"]').click();await p.locator('#reviewerName').fill('LAB REVIEWER');await p.selectOption('#reviewResult','approved');
 for(const checkbox of await p.locator('#checkTeams,#checkScore,#checkVideos,#checkPermission').all())await checkbox.check();await p.getByRole('button',{name:'最終確認を保存',exact:true}).click();await status('保存完了');
 await p.locator('[data-panel="admin"]').click();accept=false;before=await snap();await p.locator('[data-match-action="publish"]').first().click();assert.deepEqual(await snap(),before);accept=true;await p.locator('[data-match-action="publish"]').first().click();await status('保存完了');assert.equal((await rows())[0].data.published,true);assert.deepEqual((await rows())[1],cloud[1]);cases.push('filming/edit/review/publication checks retained; one target only');
 // Two real browser tabs share the fake database but keep independent auth sessions.
 const q=await context.newPage();q.on('pageerror',e=>errors.push(e.message));q.on('dialog',d=>d.accept());await q.goto(base);await login(q);await q.locator('[data-panel="admin"]').click();
 await p.locator('#editVenue').fill('FIRST TAB');await p.getByRole('button',{name:'選択中の試合を更新',exact:true}).click();await status('保存完了');
 await q.locator('#editVenue').fill('STALE TAB');await q.getByRole('button',{name:'選択中の試合を更新',exact:true}).click();await q.waitForFunction(()=>document.querySelector('#operationStatus').textContent.includes('別の画面'));
 assert.equal((await rows())[0].data.venue,'FIRST TAB');assert.equal(await q.evaluate(()=>PULSE_ADMIN_LAB.ready()),false);cases.push('two-tab stale update rejected by expected version');await q.close();
 // Lost response never retries and forces reread before another save.
 await p.selectOption('#labMode','lost-response');await p.locator('#editVenue').fill('COMMITTED WITHOUT RESPONSE');n=(await writes()).length;await p.getByRole('button',{name:'選択中の試合を更新',exact:true}).click();await status('保存結果未確認');await settled();assert.equal((await writes()).length,n+1);assert.equal((await rows())[0].data.venue,'COMMITTED WITHOUT RESPONSE');assert.equal(await p.evaluate(()=>PULSE_ADMIN_LAB.ready()),false);
 await p.selectOption('#labMode','success');await p.locator('#reloadData').click();await ready();assert.equal((await snap()).matches[0].venue,'COMMITTED WITHOUT RESPONSE');cases.push('ambiguous commit result explicit, no auto retry');
 await p.selectOption('#labMode','load-error');cloud=await rows();n=(await writes()).length;await p.locator('#reloadData').click();await status('読込失敗');assert.equal(await p.evaluate(()=>PULSE_ADMIN_LAB.ready()),false);await p.evaluate(()=>saveMatchInfo());assert.equal((await writes()).length,n);assert.deepEqual(await rows(),cloud);
 await p.reload();await p.waitForFunction(()=>PULSE_ADMIN_LAB?.backend());await status('読込失敗');assert.equal((await writes()).length,0);assert.deepEqual(await rows(),cloud);await p.selectOption('#labMode','success');await p.locator('#reloadData').click();await ready();cases.push('load failure/reload never uploads legacy local data');
 await p.locator('[data-panel="admin"]').click();await p.selectOption('#labMode','expired');await p.locator('#editVenue').fill('EXPIRED WRITE');cloud=await rows();await p.getByRole('button',{name:'選択中の試合を更新',exact:true}).click();await status('保存失敗');assert.deepEqual(await rows(),cloud);assert(await p.locator('#workflowFields').evaluate(e=>e.disabled));assert(!(await p.locator('#saveState').innerText()).includes('保存完了'));await p.selectOption('#labMode','success');await login(p);cases.push('expiry blocks save and clears authenticated view');
 await p.locator('[data-panel="admin"]').click();await p.locator('#editVenue').fill('LOGOUT DURING SAVE');await p.evaluate(()=>sessionStorage.setItem('pulse_echo_admin_safety_test_v1',JSON.stringify({delay:500})));cloud=await rows();await p.getByRole('button',{name:'選択中の試合を更新',exact:true}).dispatchEvent('click');await p.locator('#authLogout').dispatchEvent('click');await p.waitForTimeout(650);assert.deepEqual(await rows(),cloud);assert(await p.locator('#workflowFields').evaluate(e=>e.disabled));await p.evaluate(()=>sessionStorage.removeItem('pulse_echo_admin_safety_test_v1'));await login(p);cases.push('logout during delayed mock request does not commit');
 await p.locator('[data-panel="admin"]').click();
 const imported=structuredClone((await rows())[0].data);imported.venue='ONE IMPORT';imported.legacyExtra={keep:'yes'};cloud=await rows();n=(await writes()).length;
 await p.locator('#restoreInput').setInputFiles({name:'sample.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({matches:[imported]}))});await status('プレビュー');assert.equal((await writes()).length,n);accept=false;await p.locator('#importPreview button').click();assert.deepEqual(await rows(),cloud);accept=true;await p.locator('#importPreview button').click();await status('保存完了');assert.equal((await writes()).length,n+1);assert.deepEqual((await rows())[0].data.legacyExtra,{keep:'yes'});assert.deepEqual((await rows())[1],cloud[1]);cases.push('backup preview/per-row confirmation preserves unknown fields and other rows');
 const downloadPromise=p.waitForEvent('download');await p.getByRole('button',{name:'運営データをバックアップ',exact:true}).click();const download=await downloadPromise;await download.saveAs(out+'/sample-backup.json');const backup=JSON.parse(await fs.readFile(out+'/sample-backup.json','utf8'));assert.equal(backup.matches.length,2);
 await p.evaluate(()=>selectMatch('admin-lab-b-20261103'));await p.locator('#matchDate').fill('2026-11-04');await p.locator('#home').fill('NEW SAMPLE');await p.locator('#away').fill('NEW OPPONENT');cloud=await rows();n=(await writes()).length;await p.getByRole('button',{name:'＋ 試合を登録する',exact:true}).click();await status('保存完了');assert.equal((await rows()).length,3);assert.equal((await writes()).length,n+1);assert.deepEqual((await rows()).slice(0,2),cloud);
 accept=false;n=(await writes()).length;await p.locator('[data-match-action="delete"]').first().click();assert.equal((await writes()).length,n);accept=true;await p.locator('[data-match-action="delete"]').first().click();await status('削除完了');assert.equal((await rows()).length,2);cases.push('new registration, cancelled/confirmed deletion, backup download');
 // Scope and fail-closed configuration checks (no external SDK loading).
 assert.equal(await p.evaluate(async()=>{try{await PULSE_ADMIN_BACKEND.create({mode:'supabase',supabaseUrl:'https://example.invalid/',testProjectRef:'bad',adminUserId:'bad'});return 'BAD'}catch(e){return e.code}}),'CONFIG');
 for(const key of ['pulse_echo_workflow_v3','pulse_echo_pc_lab_layout_v1','pulse_echo_user_name','pulse_echo_sender_id'])assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),'KEEP OLD '+key);
 for(const file of ['config.js','data.js','match.html','index.html','pulse-echo-workflow-backup.json'])assert.equal((await context.request.get(new URL(file,base).href)).status(),404);
 const originalRows=await rows();await p.evaluate(key=>localStorage.setItem(key,'[]'),DB);await p.reload();await ready();assert.deepEqual((await snap()).matches,[]);assert.equal((await writes()).length,0);await p.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:DB,value:originalRows});await p.locator('#reloadData').click();await ready();cases.push('empty successful read is empty, never replaced by old fallback');
 for(const[width,height]of[[1440,1000],[800,1000],[390,844]]){await p.setViewportSize({width,height});await p.evaluate(()=>window.scrollTo(0,0));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`${out}/admin-${width}.png`,fullPage:true})}
 cases.push('legacy storage preserved, production files not served, responsive widths');
 assert.deepEqual(external,[]);assert.deepEqual(ws,[]);assert.deepEqual(errors,[]);
 await fs.writeFile(out+'/results.json',JSON.stringify({cases,external,ws,errors,realRlsTested:false},null,2));await browser.close();console.log('PASS',cases.length,'admin LAB scenarios / external HTTP0 WS0 / real RLS untested');
})().catch(e=>{console.error(e);process.exit(1)});
