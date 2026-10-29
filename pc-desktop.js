/* PC v1.0 entry. Never load presentation styles or move elements on other devices. */
(() => {
 const ua=navigator.userAgent;
 const mobile=/Android|iPhone|iPad|iPod|Silk|Fire TV|AFT/i.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>0)||navigator.userAgentData?.mobile===true;
 const desktop=!mobile&&/Windows NT|Macintosh|X11|CrOS|Linux/.test(ua)&&matchMedia('(any-pointer: fine)').matches&&matchMedia('(any-hover: hover)').matches;
 window.PULSE_PC_DESKTOP=desktop;
 const tvOnly=!desktop&&new URLSearchParams(location.search).get('mode')==='tv';
 if(!desktop&&!tvOnly)return;
 window.PULSE_PC_VERSION='1.2.0';
 const styles=Promise.all((desktop?['pc-base.css','tv-view.css','pc-lab.css']:['tv-view.css']).map(path=>new Promise((resolve,reject)=>{
  const link=document.createElement('link');link.rel='stylesheet';link.href=path+(path==='tv-view.css'?'?v=1.2.1':path==='pc-lab.css'?'?v=1.2.4':'?v=1.2.0');link.onload=resolve;link.onerror=()=>reject(new Error('PC stylesheet unavailable: '+path));document.head.append(link);
 })));
 function script(path){return new Promise((resolve,reject)=>{const node=document.createElement('script');node.src=path+(path==='tv-view.js'?'?v=1.2.3':path==='pc-lab.js'?'?v=1.2.4':'?v=1.2.0');node.onload=resolve;node.onerror=()=>reject(new Error('PC script unavailable: '+path));document.body.append(node)})}
 document.addEventListener('DOMContentLoaded',async()=>{
  try{
   await styles;document.body.classList.add('match-page');
   const nav=document.querySelector('.site-header .navlinks');
   const tv=document.createElement('button');tv.id='tvEnter';tv.type='button';tv.className='btn tv-entry';tv.textContent='テレビ鑑賞';
   const pc=document.createElement('button');pc.id='labEnter';pc.type='button';pc.className='btn lab-entry';pc.textContent='PC鑑賞';if(desktop)nav.prepend(tv,pc);else nav.prepend(tv);
   const toolbar=document.createElement('div');toolbar.id='tvToolbar';toolbar.className='tv-toolbar';toolbar.hidden=true;toolbar.setAttribute('aria-label','テレビ鑑賞操作');
   toolbar.innerHTML='<button class="btn" id="tvNameOpen" type="button">名前：匿名</button><div id="tvNamePanel" hidden role="dialog" aria-label="投稿者名の設定"><label for="tvNameInput">投稿者名・背番号（例：横江、12）</label><input class="input" id="tvNameInput" autocomplete="nickname" maxlength="40" placeholder="個人名・家族名・グループ名"><button class="btn" id="tvNameSave" type="button">保存</button><button class="btn" id="tvNameCancel" type="button">閉じる</button><p id="tvStorageNotice" role="status"></p></div><div id="tvStatus" role="status" aria-live="polite"></div>';
   document.body.append(toolbar);
   await script('tv-view.js');
   if(desktop){await script('pc-lab.js');document.getElementById('labReturn').textContent='PC鑑賞へ戻る'}
   window.PULSE_PC_READY=true;document.dispatchEvent(new Event('pulse-pc-ready'));
  }catch(error){console.error('[PULSE PC]',error);window.PULSE_PC_LOAD_ERROR=error.message}
 });
})();
