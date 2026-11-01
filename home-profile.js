/* Shared home entry; identity and storage remain owned by profile.js. */
(() => {
 function start(){
  const profile=window.PULSE_PROFILE,header=document.querySelector('#matches .section-head');
  if(!profile||!header)return;
  profile.init();
  const entry=document.createElement('div');entry.className='home-profile';
  entry.innerHTML='<span id="homeProfileName"></span><button class="btn" id="homeProfileOpen" type="button" aria-haspopup="dialog" aria-controls="homeProfileDialog">名前設定・変更</button>';header.append(entry);
  const dialog=document.createElement('div');dialog.id='homeProfileDialog';dialog.className='profile-setup';dialog.hidden=true;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','homeProfileTitle');
  dialog.innerHTML='<div class="profile-setup-card"><h2 id="homeProfileTitle">名前設定・変更</h2><p>このブラウザーから投稿するときの名前です。</p><label for="homeProfileInput">名前</label><input class="input" id="homeProfileInput" type="text" autocomplete="nickname" maxlength="40"><div class="profile-setup-actions"><button class="btn btn-primary" id="homeProfileSave" type="button">保存</button><button class="btn" id="homeProfileCancel" type="button">キャンセル</button></div><p id="homeProfileStatus" class="profile-setup-status" role="status" aria-live="polite"></p></div>';document.body.append(dialog);
  const input=dialog.querySelector('input'),open=document.getElementById('homeProfileOpen'),save=document.getElementById('homeProfileSave'),status=document.getElementById('homeProfileStatus');
  const refresh=()=>{document.getElementById('homeProfileName').textContent='名前：'+profile.getName()};refresh();document.addEventListener('pulse-profile-name-changed',refresh);
  let composing=false;
  input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>composing=false);
  open.onclick=()=>{input.value=profile.getName();status.textContent='';dialog.hidden=false;input.focus()};
  save.onclick=()=>{if(composing)return;if(!input.value.trim()){status.textContent='名前か背番号を入力してください。';input.focus();return}profile.setName(input.value);dialog.hidden=true};
  document.getElementById('homeProfileCancel').onclick=()=>dialog.hidden=true;
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing&&!composing&&event.keyCode!==229){event.preventDefault();save.click()}});
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.isComposing&&!composing){event.preventDefault();dialog.hidden=true}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
