/* Existing workflow UI, with explicit authentication and per-match commits. */
(() => {
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const now=()=>new Date().toISOString(),clone=value=>structuredClone(value);
let state={matches:[],selectedId:''},backend,user=null,loaded=false,busy=false,epoch=0,loadSerial=0;
let versions=new Map(),imports=[];
const cfg=window.PULSE_ADMIN_LAB_CONFIG||{};
function baseWorkflow(input){
 const m=clone(input),w=m.workflow||{},f=w.filming||{},e=w.editing||{},r=w.review||{};
 return {...m,id:m.id||makeId(m),published:m.published===true,workflow:{...w,assignedTeam:w.assignedTeam||'',filming:{status:'waiting',type:'team',filmerName:'',filmerTeam:'',onSiteChecker:'',sourceFirst:'',sourceSecond:'',issue:'',agreement:false,files:[],updatedAt:'',...f,before:{...(f.before||{})},after:{...(f.after||{})}},editing:{status:'waiting',editorName:'',memo:'',scoreAdded:false,partsChecked:false,updatedAt:'',...e},review:{status:'waiting',reviewerName:'',memo:'',updatedAt:'',...r,checks:{...(r.checks||{})}}}};
}
function slug(s){return String(s||'match').toLowerCase().normalize('NFKC').replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g,'-').replace(/^-|-$/g,'').slice(0,36)||'match'}
function makeId(m){return `${slug(m.home)}-vs-${slug(m.away)}-${String(m.date||'').replaceAll('-','')||Date.now()}`}
function selected(){return state.matches.find(m=>m.id===state.selectedId)}
function isAdmin(){return !!backend&&backend.isAdmin(user)}
function displayStatus(text,kind='info'){$('operationStatus').textContent=text;$('operationStatus').dataset.kind=kind;$('saveState').textContent=text}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}
function syncControls(){
 const allowed=isAdmin(),enabled=allowed&&loaded&&!busy;
 $('workflowArea').inert=!enabled;$('workflowFields').disabled=!enabled;
 $('exportPublic').disabled=!enabled;$('authSubmit').disabled=busy;$('reloadData').disabled=!allowed||busy;$('authLogout').hidden=!user;
 $('authForm').hidden=!!user;$('labAccountHelp').hidden=!!user||backend?.kind==='supabase';
 $('authIdentity').textContent=user?(allowed?'管理者：':'管理権限なし：')+user.email:'未ログイン';
 $('authPassword').value='';
}
function canEdit(){if(!isAdmin()||!loaded||busy){displayStatus(!isAdmin()?'管理者としてログインしてください。':!loaded?'一覧を読み直すまで保存できません。':'保存中です。完了をお待ちください。','error');return false}return true}
function validateMatch(m){
 if(typeof m.id!=='string'||!m.id.trim()||m.id.length>256||/[\u0000-\u001f]/.test(m.id))throw Error('試合IDが不正です。');
 if(!m.date||!m.home?.trim()||!m.away?.trim())throw Error('試合日と両チーム名は必須です。');
 if(![m.homeScore??0,m.awayScore??0].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('得点は0以上の整数で入力してください。');
}
async function load(){
 if(!isAdmin())return;const generation=++loadSerial,token=epoch;loaded=false;syncControls();displayStatus('一覧を読み込み中…');
 try{
  const rows=await backend.list();if(token!==epoch||generation!==loadSerial)return;
  const ids=new Set(),nextVersions=new Map();const matches=rows.map(row=>{if(ids.has(row.id)||row.id!==row.data?.id||!row.updated_at)throw Error('試合IDまたは保存版の整合性を確認できません。');ids.add(row.id);const m=baseWorkflow(row.data);validateMatch(m);nextVersions.set(row.id,row.updated_at);return m}).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  state={matches,selectedId:ids.has(state.selectedId)?state.selectedId:matches[0]?.id||''};versions=nextVersions;loaded=true;refreshAll();displayStatus(`${matches.length}試合を取得しました。選択・読込だけでは保存しません。`);
 }catch(error){if(token===epoch&&generation===loadSerial)displayStatus('読込失敗：'+error.message+' 自動送信は行いません。','error')}
 finally{if(token===epoch&&generation===loadSerial)syncControls()}
}
async function commit(candidate,operation='update'){
 if(!canEdit())return false;try{validateMatch(candidate)}catch(error){displayStatus(error.message,'error');return false}
 const target=candidate.id,expected=versions.get(target),token=epoch;busy=true;syncControls();displayStatus(`${candidate.home} vs ${candidate.away}［${target}］を保存中…`);
 try{
  const result=await backend[operation==='delete'?'remove':operation==='insert'?'insert':'update'](clone(candidate),expected);
  if(token!==epoch)return false;
  if(operation==='delete'){state.matches=state.matches.filter(m=>m.id!==target);versions.delete(target)}
  else{if(result?.id!==target||result.data?.id!==target||!result.updated_at)throw Object.assign(Error('応答の整合性を確認できません。再読み込みしてください。'),{code:'UNKNOWN'});const saved=baseWorkflow(result.data),index=state.matches.findIndex(m=>m.id===target);if(index<0)state.matches.unshift(saved);else state.matches[index]=saved;versions.set(target,result.updated_at);state.selectedId=target}
  if(!state.matches.some(m=>m.id===state.selectedId))state.selectedId=state.matches[0]?.id||'';
  refreshAll();displayStatus(`${candidate.home} vs ${candidate.away}［${target}］：${operation==='delete'?'削除':'保存'}完了`,'success');return true;
 }catch(error){
  if(token!==epoch&&error.code==='AUTH'&&!user)displayStatus(`［${target}］保存失敗：${error.message}`,'error');
  if(token===epoch){if(['CONFLICT','UNKNOWN','AUTH'].includes(error.code))loaded=false;displayStatus(`［${target}］${error.code==='UNKNOWN'?'保存結果未確認':'保存失敗'}：${error.message}`,'error')}
  return false;
 }finally{if(token===epoch){busy=false;syncControls()}}
}
async function edit(change){if(!canEdit())return;const m=selected();if(!m)return;const candidate=clone(m);try{if(change(candidate)===false){displayStatus('保存をキャンセルしました。変更は反映していません。');return;}await commit(candidate)}catch(error){displayStatus(error.message,'error')}}
function selectMatch(id){if(!canEdit())return;state.selectedId=id;refreshAll();displayStatus('選択中の試合を切り替えました。保存はしていません。')}
function options(){
 return state.matches.length?state.matches.map(m=>`<option value="${esc(m.id)}" ${m.id===state.selectedId?"selected":""}>${esc(m.date||"日付未定")}｜${esc(m.home)} vs ${esc(m.away)}</option>`).join(""):'<option>試合がありません</option>'
}
document.querySelectorAll(".match-select").forEach(s=>s.onchange=e=>selectMatch(e.target.value));
document.querySelectorAll(".role-btn").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".role-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");
 document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));$(b.dataset.panel).classList.add("active")
});

function statusLabel(m){
 const f=m.workflow.filming.status,e=m.workflow.editing.status,r=m.workflow.review.status;
 if(m.published)return["公開中","s-public"];
 if(f==="issue"||e==="issue")return["問題あり","s-issue"];
 if(r==="approved")return["公開待ち","s-review"];
 if(e==="done")return["最終確認待ち","s-review"];
 if(e==="editing")return["編集中","s-editing"];
 if(f==="done")return["編集待ち","s-filming"];
 return["準備中","s-draft"]
}
function progressHTML(m){
 if(!m)return'<div class="empty">全体管理者が試合を登録すると、ここに表示されます。</div>';
 const f=m.workflow.filming,e=m.workflow.editing,r=m.workflow.review;
 const cls=(ok,issue)=>issue?"issue":ok?"done":"";
 return `<div class="progress-card"><div class="progress-title">${esc(m.home)} ${m.homeScore??0} - ${m.awayScore??0} ${esc(m.away)}</div>
 <div class="progress-meta">${esc(m.date||"日付未定")}　${esc(m.competition||"")}</div>
 <div class="progress-grid">
 <div class="pill ${cls(true)}">① 試合登録</div>
 <div class="pill ${cls(f.status==="done",f.status==="issue")}">② 撮影確認</div>
 <div class="pill ${cls(f.status==="done",f.status==="issue")}">③ 素材提出</div>
 <div class="pill ${cls(e.status==="done",e.status==="issue")}">④ 編集</div>
 <div class="pill ${cls(r.status==="approved")}">⑤ 最終確認</div>
 </div></div>`
}
function fillForm(){
 const m=selected();if(!m)return;
 const f=m.workflow.filming,e=m.workflow.editing,r=m.workflow.review;
 $("filmerName").value=f.filmerName||"";$("filmerTeam").value=f.filmerTeam||"";$("filmingType").value=f.type||"team";$("onSiteChecker").value=f.onSiteChecker||"";
 $("sourceFirst").value=f.sourceFirst||"";$("sourceSecond").value=f.sourceSecond||"";$("filmingIssue").value=f.issue||"";$("filmingAgreement").checked=!!f.agreement;
 document.querySelectorAll("#beforeChecks input").forEach(x=>x.checked=!!f.before[x.dataset.key]);
 document.querySelectorAll("#afterChecks input").forEach(x=>x.checked=!!f.after[x.dataset.key]);
 $("editorName").value=e.editorName||"";$("editingState").value=e.status||"waiting";$("youtubeFirst").value=m.firstHalfVideo||"";$("youtubeSecond").value=m.secondHalfVideo||"";$("youtubeHighlight").value=m.highlightVideo||"";$("editorMemo").value=e.memo||"";$("scoreAdded").checked=!!e.scoreAdded;$("partsChecked").checked=!!e.partsChecked;
 $("reviewerName").value=r.reviewerName||"";$("reviewResult").value=r.status||"waiting";$("reviewMemo").value=r.memo||"";
 $("checkTeams").checked=!!r.checks.teams;$("checkScore").checked=!!r.checks.score;$("checkVideos").checked=!!r.checks.videos;$("checkPermission").checked=!!r.checks.permission;
 updateRequestNotice()
}
$("filmingType").onchange=updateRequestNotice;
function updateRequestNotice(){
 const t=$("filmingType").value,n=$("requestNotice");
 if(t==="request"){n.className="notice red";n.innerHTML="<b>PULSE ECHO側への撮影依頼</b><br>依頼チームは、会場・対戦相手への確認と現場確認者の配置を担当します。機材・会場・不可抗力による完全撮影は保証されません。"}
 else if(t==="external"){n.className="notice";n.innerHTML="<b>外部撮影者への依頼</b><br>依頼条件、納品方法、撮影不備時の扱いを事前に共有してください。"}
 else{n.className="notice";n.innerHTML="<b>出場チーム関係者による撮影</b><br>撮影・保存・再生確認・アップロードまで、担当チーム側で確認してください。"}
}
$("localFiles").onchange=e=>{
 const files=[...e.target.files];
 $("fileResult").textContent=files.length?files.map(f=>`${f.name}（${(f.size/1024/1024).toFixed(1)}MB）`).join(" ／ "):"";
}

function saveFilming(){return edit(m=>{
 const f=m.workflow.filming;
 for(const [key,id]of Object.entries({filmerName:'filmerName',filmerTeam:'filmerTeam',type:'filmingType',onSiteChecker:'onSiteChecker',sourceFirst:'sourceFirst',sourceSecond:'sourceSecond',issue:'filmingIssue'}))f[key]=$(id).value.trim();
 f.agreement=$('filmingAgreement').checked;f.before={};f.after={};
 document.querySelectorAll('#beforeChecks input').forEach(x=>f.before[x.dataset.key]=x.checked);
 document.querySelectorAll('#afterChecks input').forEach(x=>f.after[x.dataset.key]=x.checked);
 f.files=[...$('localFiles').files].map(x=>({name:x.name,size:x.size}));
 if(!f.filmerName)throw Error('撮影担当者名を入力してください。');
 if(f.type==='request'&&!f.onSiteChecker)throw Error('撮影依頼では現場確認者を入力してください。');
 const complete=Object.values(f.before).every(Boolean)&&Object.values(f.after).every(Boolean)&&f.agreement&&f.sourceFirst&&f.sourceSecond;
 if(!complete&&!confirm('確認項目または素材共有先が不足しています。未完了として保存しますか？'))return false;
 f.status=complete?'done':'working';f.updatedAt=now();
})}
function markFilmingIssue(){return edit(m=>{const issue=$('filmingIssue').value.trim();if(!issue)throw Error('撮影不備の内容を入力してください。');m.workflow.filming.issue=issue;m.workflow.filming.status='issue';m.workflow.filming.updatedAt=now();m.published=false})}
function saveEditing(){return edit(m=>{
 const e=m.workflow.editing;e.editorName=$('editorName').value.trim();e.status=$('editingState').value;e.memo=$('editorMemo').value.trim();e.scoreAdded=$('scoreAdded').checked;e.partsChecked=$('partsChecked').checked;e.updatedAt=now();
 m.firstHalfVideo=$('youtubeFirst').value.trim();m.secondHalfVideo=$('youtubeSecond').value.trim();m.highlightVideo=$('youtubeHighlight').value.trim();
 if(e.status==='done'&&(!e.editorName||!e.scoreAdded||!e.partsChecked||(!m.firstHalfVideo&&!m.secondHalfVideo)))throw Error('編集担当者、確認項目、動画URLを確認してください。');
 if(e.status==='issue')m.published=false;
})}
function saveReview(){return edit(m=>{
 const r=m.workflow.review;r.reviewerName=$('reviewerName').value.trim();r.status=$('reviewResult').value;r.memo=$('reviewMemo').value.trim();r.updatedAt=now();r.checks={teams:$('checkTeams').checked,score:$('checkScore').checked,videos:$('checkVideos').checked,permission:$('checkPermission').checked};
 if(r.status==='approved'&&(!r.reviewerName||!Object.values(r.checks).every(Boolean)))throw Error('確認担当者名と4つの確認項目が必要です。');
 if(r.status!=='approved')m.published=false;
})}
function openPreview(){displayStatus('このLABは架空試合だけを扱います。公開視聴ページへの送信・連携はしません。')}
async function addMatch(){
 if(!canEdit())return;const m=baseWorkflow({date:$('matchDate').value,competition:$('competition').value.trim(),venue:$('venue').value.trim(),home:$('home').value.trim(),away:$('away').value.trim(),homeScore:Number($('homeScore').value),awayScore:Number($('awayScore').value),description:$('description').value.trim(),firstHalfVideo:'',secondHalfVideo:'',highlightVideo:'',homeLogo:'',awayLogo:'',published:false});
 m.workflow.assignedTeam=$('assignedTeam').value.trim();if(state.matches.some(x=>x.id===m.id))m.id+='-'+crypto.randomUUID();
 if(await commit(m,'insert')){['matchDate','competition','venue','home','away','assignedTeam','description'].forEach(id=>$(id).value='');$('homeScore').value=0;$('awayScore').value=0}
}
function renderMatchEditor(){
 const el=$("matchEditBox"),m=selected();
 if(!el)return;
 if(!m){el.innerHTML='<div class="empty">修正する試合を選んでください。</div>';return}
 el.innerHTML=`<div class="grid">
  <div class="field"><label>試合日</label><input class="input" id="editMatchDate" type="date" value="${esc(m.date||"")}"></div>
  <div class="field"><label>大会名・節</label><input class="input" id="editCompetition" value="${esc(m.competition||"")}"></div>
  <div class="field"><label>左側チーム</label><input class="input" id="editHome" value="${esc(m.home||"")}"></div>
  <div class="field"><label>右側チーム</label><input class="input" id="editAway" value="${esc(m.away||"")}"></div>
  <div class="field"><label>左側得点</label><input class="input" id="editHomeScore" type="number" min="0" value="${esc(m.homeScore??0)}"></div>
  <div class="field"><label>右側得点</label><input class="input" id="editAwayScore" type="number" min="0" value="${esc(m.awayScore??0)}"></div>
  <div class="field"><label>会場</label><input class="input" id="editVenue" value="${esc(m.venue||"")}"></div>
  <div class="field"><label>撮影担当チーム</label><input class="input" id="editAssignedTeam" value="${esc(m.workflow.assignedTeam||"")}"></div>
  <div class="field full"><label>試合説明</label><textarea class="input" id="editDescription">${esc(m.description||"")}</textarea></div>
 </div>
 <div class="actions"><button class="btn btn-primary" onclick="saveMatchInfo()">選択中の試合を更新</button></div>`;
}
function saveMatchInfo(){return edit(m=>{
 for(const [key,id]of Object.entries({date:'editMatchDate',competition:'editCompetition',home:'editHome',away:'editAway',venue:'editVenue',description:'editDescription'}))m[key]=$(id).value.trim();
 m.homeScore=Number($('editHomeScore').value);m.awayScore=Number($('editAwayScore').value);m.workflow.assignedTeam=$('editAssignedTeam').value.trim();
})}
function newFilmingRequest(){
 document.querySelector('[data-panel="admin"]').click();
 $("assignedTeam").focus();
 toast("全体管理者画面で試合と撮影担当を登録してください")
}
async function togglePublish(id){
 if(!canEdit())return;const original=state.matches.find(x=>x.id===id);if(!original)return;const m=clone(original);
 if(!m.published&&(m.workflow.filming.status!=='done'||m.workflow.editing.status!=='done'||m.workflow.review.status!=='approved')){displayStatus('撮影確認・編集完了・最終確認OKが揃っていません。','error');return}
 if(!confirm(`［${m.id}］を${m.published?'公開停止':'公開'}にしますか？`))return;m.published=!m.published;await commit(m);
}
async function deleteMatch(id){if(!canEdit())return;const m=state.matches.find(x=>x.id===id);if(m&&confirm(`「${m.home} vs ${m.away}」を削除しますか？`))await commit(clone(m),'delete')}
function renderAdmin(){
 const el=$("adminList");
 if(!state.matches.length){el.innerHTML='<div class="empty">試合はまだありません。</div>';return}
 el.innerHTML=state.matches.map(m=>{
  const [label,cls]=statusLabel(m),f=m.workflow.filming,e=m.workflow.editing,r=m.workflow.review;
  return `<div class="match-card"><div class="match-card-top"><div><div class="match-card-title">${esc(m.home)} ${m.homeScore??0} - ${m.awayScore??0} ${esc(m.away)}</div>
  <div class="match-card-meta">${esc(m.date||"")}　${esc(m.competition||"")}<br>撮影：${esc(f.filmerName||m.workflow.assignedTeam||"未設定")} ／ 編集：${esc(e.editorName||"未設定")} ／ 確認：${esc(r.reviewerName||"未設定")}</div></div>
  <span class="status ${cls}">${label}</span></div>
  <div class="actions"><button class="btn btn-small ${m.published?"btn-yellow":"btn-green"}" data-match-action="publish" data-match-id="${esc(m.id)}">${m.published?"公開停止":"公開する"}</button>
  <button class="btn btn-small" data-match-action="select" data-match-id="${esc(m.id)}">この試合を開く</button>
  <button class="btn btn-small btn-red" data-match-action="delete" data-match-id="${esc(m.id)}">削除</button></div></div>`
 }).join("")
}
function refreshAll(){
 document.querySelectorAll(".match-select").forEach(s=>{s.innerHTML=options();s.disabled=!state.matches.length});
 const m=selected();
 $("filmerProgress").innerHTML=progressHTML(m);$("editorProgress").innerHTML=progressHTML(m);$("reviewProgress").innerHTML=progressHTML(m);
 renderAdmin();fillForm();renderMatchEditor()
}
function download(name,text,type){
 const b=new Blob([text],{type}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1200)
}
function exportPublicData(){
 if(!canEdit())return;
 const publicMatches=state.matches.filter(m=>m.published).map(m=>{
  const x={...m};delete x.workflow;return x
 });
 download("data.js","window.PULSE_MATCHES = "+JSON.stringify(publicMatches,null,2)+";\n","text/javascript;charset=utf-8");
 toast(`${publicMatches.length}試合をdata.jsへ書き出しました`)
}
function backupWorkflow(){if(!canEdit())return;download("pulse-echo-workflow-backup.json",JSON.stringify({version:3,exportedAt:now(),...state},null,2),"application/json;charset=utf-8");toast("バックアップを書き出しました")}

$('adminList').addEventListener('click',e=>{const b=e.target.closest('[data-match-action]');if(!b)return;const actions={publish:togglePublish,select:selectMatch,delete:deleteMatch};actions[b.dataset.matchAction]?.(b.dataset.matchId)});
$('restoreInput').onchange=async e=>{
 const f=e.target.files[0];if(!f||!canEdit())return;const importEpoch=epoch;imports=[];$('importPreview').replaceChildren();
 try{const obj=JSON.parse(await f.text());if(importEpoch!==epoch||!isAdmin())return;if(!Array.isArray(obj.matches)||obj.matches.length>1000)throw Error('1000試合以下のバックアップを選んでください。');const ids=new Set();const next=obj.matches.map(input=>{const m=baseWorkflow(input);validateMatch(m);if(ids.has(m.id))throw Error('バックアップ内の試合IDが重複しています。');ids.add(m.id);return m});imports=next;$('importPreview').replaceChildren();for(const [i,m]of imports.entries()){const b=document.createElement('button');b.className='btn';b.type='button';b.textContent=m.home+' vs '+m.away+'：この1試合だけ確認して保存';b.onclick=()=>saveImported(i);$('importPreview').append(b)}displayStatus('バックアップをプレビューしました。まだ保存していません。既存試合の一括削除・全件置換はしません。')}
 catch(error){displayStatus('バックアップ確認失敗：'+error.message,'error')}finally{e.target.value=''}
};
async function saveImported(i){if(!canEdit())return;const m=imports[i];if(!m||!confirm(`［${m.id}］だけを保存しますか？ 動画URL・公開状態もバックアップの内容になります。`))return;await commit(clone(m),versions.has(m.id)?'update':'insert')}
function resetWorkflow(){if(canEdit()&&confirm('画面を再読み込みしますか？ 未保存の入力は破棄します。共有データや旧設定は変更しません。'))load()}
function authChanged(next){
 const changed=user?.id!==next?.id;user=next;if(!changed){syncControls();return}
 epoch++;loadSerial++;busy=false;loaded=false;for(const input of document.querySelectorAll('#workflowArea input,#workflowArea textarea')){if(input.type==='checkbox')input.checked=false;else input.value=''}state={matches:[],selectedId:''};versions.clear();imports=[];$('importPreview').replaceChildren();refreshAll();syncControls();
 if(!user)displayStatus('未ログインです。共有保存は停止しています。');else if(!isAdmin())displayStatus('このアカウントに管理権限はありません。','error');else load();
}
$('authForm').onsubmit=async event=>{event.preventDefault();if(!backend||busy)return;const email=$('authEmail').value.trim(),password=$('authPassword').value;busy=true;syncControls();try{authChanged(await backend.signIn(email,password))}catch(error){displayStatus(error.message,'error')}finally{busy=false;syncControls()}};
$('authLogout').onclick=async()=>{try{await backend.signOut();authChanged(null)}catch(error){displayStatus(error.message,'error')}};
$('reloadData').onclick=()=>{if(!busy)load()};
$('labMode').onchange=e=>{backend?.diagnostics?.setMode(e.target.value)};
$('labExpire').onclick=()=>backend?.diagnostics?.expire();
$('labReset').onclick=()=>{if(backend?.diagnostics&&!busy&&confirm('このLABの架空データだけを初期化しますか？')){backend.diagnostics.reset();if(isAdmin())load()}};
window.PULSE_ADMIN_LAB=Object.freeze({snapshot:()=>clone(state),backend:()=>backend,ready:()=>loaded,version:id=>versions.get(id)});
Object.assign(window,{saveFilming,markFilmingIssue,saveEditing,saveReview,openPreview,addMatch,saveMatchInfo,newFilmingRequest,selectMatch,togglePublish,deleteMatch,backupWorkflow,resetWorkflow,exportPublicData,refreshAll});
(async()=>{try{backend=await window.PULSE_ADMIN_BACKEND.create(cfg);backend.subscribe(authChanged);if(backend.kind==='local'){backend.restoreMode();$('labMode').value=backend.diagnostics.mode()}else{$('labSimulation').hidden=true;$('labAccountHelp').hidden=true}authChanged(await backend.init());syncControls()}catch(error){displayStatus('起動停止：'+error.message,'error');syncControls()}})();
})();
