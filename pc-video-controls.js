/* Video controls for flexible desktop viewing only. No persistent settings. */
(() => {
 if(window.PULSE_PC_DESKTOP!==true)return;
 const requested=new URLSearchParams(location.search).get('mode');
 let mode=requested==='tv'?'tv':requested==='review'?'review':'lab';
 let driver=null,configured=null,handoff=null,restoring=null,ui=null,lastPlaying=false;
 const desired=()=>mode==='lab'?0:1;
 const player=()=>driver?.getPlayer();
 const ready=()=>Boolean(driver?.isReady());
 const message=text=>{if(ui)ui.status.textContent=text};
 function capture(){
  const p=player();if(!p||!ready())return null;
  try{return{videoId:p.getVideoData().video_id,time:Number(p.getCurrentTime())||0,playing:p.getPlayerState()===1||(p.getPlayerState()===3&&lastPlaying),volume:p.getVolume(),muted:p.isMuted()}}catch{return null}
 }
 function syncMode(next){
  mode=next;
  if(configured===null||configured===desired()||!player())return;
  handoff=handoff||capture();restoring=null;
  message('動画操作を切り替え中…');driver.recreate();
 }
 document.addEventListener('pulse-view-mode',e=>syncMode(e.detail.mode));
 function applyAudio(p,state){p.setVolume(state.volume);state.muted?p.mute():p.unMute()}
 function onReady(p){
  if(!handoff){message('');return}
  restoring={player:p,deadline:Date.now()+12000};
  try{
   applyAudio(p,handoff);p.seekTo(handoff.time,true);
   if(handoff.playing)p.playVideo();else p.pauseVideo();
  }catch{message('動画の準備後に操作してください。')}
 }
 function onStateChange(event){
  if(event.data===1)lastPlaying=true;else if([0,2,5].includes(event.data))lastPlaying=false;
  if(!restoring||event.target!==restoring.player||!handoff)return;
  if(!handoff.playing&&event.data===1)event.target.pauseVideo();
 }
 function update(){
  const p=player();
  if(restoring&&ready()&&p===restoring.player&&handoff){
   try{
    const s=p.getPlayerState(),settled=handoff.playing?s===1:[-1,0,2,5].includes(s);
    if(settled&&Math.abs(p.getCurrentTime()-handoff.time)<3&&Math.abs(p.getVolume()-handoff.volume)<1&&p.isMuted()===handoff.muted){
     // A new YouTube iframe can retain the stopped position in UNSTARTED (-1).
     restoring.stableSince=restoring.stableSince||Date.now();
     if(Date.now()-restoring.stableSince>=400){restoring=null;handoff=null;message('')}
    }else if(restoring.stableSince){restoring.stableSince=null}
    if(restoring&&Date.now()>restoring.deadline){restoring=null;handoff=null;message('再生状態の復元を確認できません。動画操作を確認してください。')}
   }catch{}
  }
  if(!ui)return;
  const available=ready()&&p;
  ui.play.disabled=Boolean(restoring);ui.volume.disabled=!available||Boolean(restoring);ui.mute.disabled=!available||Boolean(restoring);
  try{
   const playing=available&&p.getPlayerState()===1;
   ui.play.textContent=playing?'Ⅱ 一時停止':'▶ 再生';ui.play.setAttribute('aria-label',playing?'一時停止':'再生');
   if(available){
    const volume=Math.round(p.getVolume()),muted=p.isMuted();
    if(document.activeElement!==ui.volume)ui.volume.value=String(volume);
    ui.output.textContent=volume+'％';ui.mute.textContent=muted?'音を出す':'ミュート';ui.mute.setAttribute('aria-pressed',String(muted));
   }
  }catch{}
  ui.full.textContent=document.fullscreenElement?'全画面を解除':'全画面';ui.full.setAttribute('aria-pressed',String(Boolean(document.fullscreenElement)));
 }
 function createMenu(togglePlayback){
  const section=document.createElement('section');section.id='pcVideoControls';
  section.innerHTML='<h2>動画操作</h2><div class="pc-video-actions"><button class="btn" id="pcVideoPlay" type="button">▶ 再生</button><button class="btn" id="pcVideoMute" type="button" aria-pressed="false">ミュート</button><button class="btn" id="pcVideoFullscreen" type="button" aria-pressed="false">全画面</button></div><label class="pc-video-volume" for="pcVideoVolume">音量 <input id="pcVideoVolume" type="range" min="0" max="100" step="1" value="100"><output id="pcVideoVolumeValue" for="pcVideoVolume">100％</output></label><a id="pcVideoYouTube" target="_blank" rel="noopener noreferrer">YouTubeで開く</a><p id="pcVideoStatus" role="status" aria-live="polite"></p>';
  ui={play:section.querySelector('#pcVideoPlay'),mute:section.querySelector('#pcVideoMute'),full:section.querySelector('#pcVideoFullscreen'),volume:section.querySelector('#pcVideoVolume'),output:section.querySelector('#pcVideoVolumeValue'),status:section.querySelector('#pcVideoStatus')};
  ui.play.onclick=togglePlayback;
  ui.volume.oninput=()=>{if(ready()){player().setVolume(Number(ui.volume.value));ui.output.textContent=ui.volume.value+'％'}};
  ui.mute.onclick=()=>{if(ready()){const p=player();p.isMuted()?p.unMute():p.mute();update()}};
  ui.full.disabled=!document.fullscreenEnabled;
  ui.full.onclick=async()=>{
   try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();message('')}
   catch{message('このブラウザーでは全画面に切り替えられません。')}
   update();
  };
  const link=section.querySelector('#pcVideoYouTube');
  function syncLink(){try{const p=player(),id=p?.getVideoData?.().video_id||driver?.getVideoId();if(id)link.href='https://www.youtube.com/watch?v='+encodeURIComponent(id)+'&t='+Math.floor(p?.getCurrentTime?.()||0)+'s'}catch{}}
  link.addEventListener('click',syncLink);document.getElementById('labMenuToggle')?.addEventListener('click',syncLink);syncLink();
  document.addEventListener('fullscreenchange',update);
  document.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&document.fullscreenElement===document.documentElement){event.preventDefault();document.exitFullscreen().catch(()=>message('全画面を解除できません。'))}
  },true);
  update();return section;
 }
 window.PULSE_PC_VIDEO=Object.freeze({
  bind(value){driver=value},
  playerVars(videoId){configured=desired();if(handoff&&handoff.videoId!==videoId){handoff=null;restoring=null}return{controls:configured}},
  onReady,onStateChange,createMenu,
  videoChanging(videoId){if(handoff&&handoff.videoId!==videoId){handoff=null;restoring=null}},
  isRestoring(){return Boolean(handoff)}
 });
 setInterval(update,200);
})();
