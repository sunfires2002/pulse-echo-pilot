/* TV-only identity entry points. Storage and guest generation stay in profile.js. */
(() => {
 if(new URLSearchParams(location.search).get('mode')!=='tv')return;
 function start(){
  const profile=window.PULSE_PROFILE;if(!profile)return;
  function visible(node){return node&&!node.hidden&&node.getClientRects().length>0}
  function bindModal(dialog,initial,restore){
   dialog.classList.add('tv-profile-dialog');
   const controls=()=>[...dialog.querySelectorAll('input,button,a[href],[tabindex]')].filter(node=>!node.disabled&&node.tabIndex>=0&&visible(node));
   const focusInitial=()=>{if(!dialog.hidden)(initial()||controls()[0])?.focus({preventScroll:true})};
   dialog.addEventListener('keydown',event=>{
    if(event.key!=='Tab'||dialog.hidden)return;
    const items=controls(),index=items.indexOf(document.activeElement);
    if(!items.length){event.preventDefault();return}
    if(index<0||event.shiftKey&&index===0||!event.shiftKey&&index===items.length-1){event.preventDefault();items[event.shiftKey?items.length-1:0].focus({preventScroll:true})}
   });
   document.addEventListener('focusin',event=>{if(!dialog.hidden&&!dialog.contains(event.target))focusInitial()});
   let wasOpen=!dialog.hidden;
   new MutationObserver(()=>{const open=!dialog.hidden;if(open&&!wasOpen)focusInitial();else if(!open&&wasOpen){const target=restore();if(visible(target))target.focus({preventScroll:true})}wasOpen=open}).observe(dialog,{attributes:true,attributeFilter:['hidden']});
   if(wasOpen)focusInitial();
  }
  const first=document.getElementById('profileSetup');
  if(first){bindModal(first,()=>document.getElementById('profileNameSkip'),()=>document.getElementById('tvHome'));return}
  // The home page initializes the same identity API, without an automatic gate.
  profile.init();
  const header=document.querySelector('#matches .section-head');if(!header)return;
  const entry=document.createElement('div');entry.className='tv-profile-home';
  const name=document.createElement('span'),open=document.createElement('button');name.id='tvHomeProfileName';open.id='tvHomeProfileOpen';open.className='btn';open.type='button';open.textContent='名前設定・変更';open.setAttribute('aria-haspopup','dialog');open.setAttribute('aria-controls','tvHomeProfileDialog');entry.append(name,open);header.append(entry);
  const refresh=()=>{name.textContent='名前：'+profile.getName()};refresh();document.addEventListener('pulse-profile-name-changed',refresh);
  const dialog=document.createElement('div');dialog.id='tvHomeProfileDialog';dialog.className='profile-setup';dialog.hidden=true;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','tvHomeProfileTitle');
  dialog.innerHTML='<div class="profile-setup-card"><h2 id="tvHomeProfileTitle">名前設定・変更</h2><p>この端末から投稿するときの名前です。</p><label for="tvHomeProfileInput">名前</label><input class="input" id="tvHomeProfileInput" autocomplete="nickname" maxlength="40"><div class="profile-setup-actions"><button class="btn btn-primary" id="tvHomeProfileSave" type="button">保存</button><button class="btn" id="tvHomeProfileCancel" type="button">キャンセル</button></div><p class="profile-setup-status" id="tvHomeProfileStatus" role="status" aria-live="polite"></p></div>';document.body.append(dialog);
  const input=dialog.querySelector('input'),save=document.getElementById('tvHomeProfileSave'),status=document.getElementById('tvHomeProfileStatus');
  bindModal(dialog,()=>input,()=>open);
  open.onclick=()=>{input.value=profile.getName();status.textContent='';dialog.hidden=false};
  save.onclick=()=>{if(!input.value.trim()){status.textContent='名前か背番号を入力してください。';input.focus();return}profile.setName(input.value);dialog.hidden=true};
  document.getElementById('tvHomeProfileCancel').onclick=()=>dialog.hidden=true;
  input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();save.click()}});
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();dialog.hidden=true}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
