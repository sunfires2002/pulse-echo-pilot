/* Television presentation only. Existing player and ECHO handlers remain in place. */
(() => {
 const body=document.body, shell=document.getElementById("videoShell");
 const map=document.querySelector(".heatmap"), toolbar=document.getElementById("tvToolbar");
 const enter=document.getElementById("tvEnter");
 const home=document.createElement("a");home.id="tvHome";home.href="./?mode=tv";home.textContent="⌂ ホーム";home.setAttribute("aria-label","試合一覧へ戻る");body.append(home);
 const nameField=document.getElementById("echoNameInput"), namePanel=document.getElementById("tvNamePanel"), nameInput=document.getElementById("tvNameInput");
 const nameButton=document.getElementById("tvNameOpen"), status=document.getElementById("tvStatus");
 let statusTimer;
 function clearStatus(){clearTimeout(statusTimer);status.textContent=""}
 function announce(text){clearStatus();status.textContent=text;statusTimer=setTimeout(clearStatus,1800)}
 function refreshName(){nameButton.textContent="名前："+(window.PULSE_PROFILE?.getName()||nameField.value.trim()||"匿名")}
 refreshName();
 nameField.addEventListener("input",refreshName);
 body.dataset.tvLayout="large";
 nameButton.addEventListener("click",()=>{nameInput.value=nameField.value;namePanel.hidden=false;document.getElementById("tvStorageNotice").textContent="";nameInput.focus()});
 function closeName(){namePanel.hidden=true;nameButton.focus()}
 document.getElementById("tvNameCancel").addEventListener("click",closeName);
 document.getElementById("tvNameSave").addEventListener("click",()=>{
  if(!nameInput.value.trim()){document.getElementById("tvStorageNotice").textContent="名前か背番号を入力してください。";nameInput.focus();return}
  window.PULSE_PROFILE?.setName(nameInput.value);nameField.value=nameInput.value.trim();refreshName();closeName();announce("名前を保存しました");
 });
 document.addEventListener("pulse-profile-name-changed",refreshName);
 const placeholder=document.createComment("reaction map original position");
 map.before(placeholder);
 const dock=document.createElement("div");dock.id="tvMapDock";dock.hidden=true;shell.append(dock);
 const legend=document.createElement("div");legend.className="tv-reactions";legend.setAttribute("aria-label","反応マップの凡例兼投稿ボタン");
 const reactionGroup=document.createElement("div");reactionGroup.className="tv-reaction-group";
 const reactLabel=document.createElement("span");reactLabel.className="tv-react-planned";reactLabel.textContent="REACT";reactLabel.setAttribute("aria-label","REACT（表示のみ）");
 const reactions=[
  ["🔥 ナイスプレー","🔥 ナイスプレー","#ff4757"],
  ["😫 惜しい","😫 惜しい","#8b5cf6"],
  ["😂 あちゃー","😅 あちゃー","#ffa502"],
  ["😲 マジで","😳 マジで","#2ed573"],
  ["🎙 その他","🤖 AIにお任せ","#00cec9"]
 ];
 reactions.forEach(([label,kind,color])=>{
  const button=document.createElement("button");button.className="tv-react";button.type="button";
  button.dataset.tvKind=kind;button.style.setProperty("--reaction-color",color);button.textContent=label;button.setAttribute("aria-label",label);
  reactionGroup.append(button);
 });
 legend.append(home,nameButton,reactionGroup,reactLabel);dock.append(legend);shell.append(toolbar);
 // Hide the canvas legend only in TV mode: the five buttons serve as its legend.
 if(window.Chart)Chart.register({id:"pulseTvLegend",beforeUpdate(instance){
  if(instance.canvas.id==="chart"){
   const active=body.classList.contains("tv-mode");
   instance.options.plugins.legend.display=!active;
   // Linear TV seconds and desktop seconds both use exact plot endpoints.
   instance.options.scales.x.offset=false;
  }
 }});
 function setMode(active,variant="tv"){
  if((!active||variant!=="lab")&&document.body.classList.contains("tactics-open"))document.getElementById("tacticToggle")?.click();
  clearStatus();namePanel.hidden=true;refreshName();
  body.classList.toggle("tv-mode",active);body.classList.toggle("lab-mode",active&&variant==="lab");toolbar.hidden=!active;dock.hidden=!active;
  if(active)dock.append(map);else placeholder.after(map);
  const url=new URL(location.href);if(active)url.searchParams.set("mode",variant);else url.searchParams.delete("mode");
  history.replaceState(null,"",url);
  requestAnimationFrame(()=>{window.dispatchEvent(new Event("resize"));if(typeof chart!=="undefined"&&chart){chart.update("none");chart.resize()}});
  if(!active)enter.focus({preventScroll:true});
  document.dispatchEvent(new CustomEvent("pulse-view-mode",{detail:{mode:active?variant:"review"}}));
 }
 window.PULSE_VIEW=Object.freeze({setMode});
 enter.addEventListener("click",()=>setMode(true));
 legend.querySelectorAll(".tv-react").forEach(button=>button.addEventListener("click",()=>{
  const source=button.dataset.tvSource?document.getElementById(button.dataset.tvSource):
   [...document.querySelectorAll(".react[data-kind]")].find(el=>el.dataset.kind===button.dataset.tvKind);
  if(!source)return;
  source.click();
  announce(button.getAttribute("aria-label")+"を選択");
 }));
 // TV seconds use the actual Chart.js scale; PC controls remain separate.
 const canvas=document.getElementById("chart");
 const playhead=document.createElement("div");playhead.className="tv-playhead";playhead.hidden=true;map.append(playhead);
 const timeLabel=document.createElement("span");timeLabel.className="tv-map-time";toolbar.append(timeLabel);
 const tvActive=()=>body.classList.contains("tv-mode")&&!body.classList.contains("lab-mode");
 let expectedVideoId=document.querySelector('.tab.active')?.dataset.video||'',awaitingVideo=false,duration=0;
 function filteredEvents(){const filter=document.getElementById('viewFilter').value;return filter==='all'?events:events.filter(e=>e.user_name===filter)}
 function redrawTv(){if(tvActive()&&typeof draw==='function'&&typeof events!=='undefined')draw(filteredEvents())}
 function actualDuration(){
  if(awaitingVideo||typeof player==='undefined'||typeof playerReady==='undefined'||!playerReady||!player?.getDuration)return 0;
  try{
   const id=player.getVideoData?.().video_id,selected=document.querySelector('.tab.active')?.dataset.video;
   if(!id||(expectedVideoId&&id!==expectedVideoId)||(selected&&id!==selected))return 0;
   const value=Number(player.getDuration());return Number.isFinite(value)&&value>0?value:0;
  }catch{return 0}
 }
 function axis(){
  if(!tvActive()||duration<=0||typeof chart==='undefined'||!chart?.chartArea||chart.scales.x.type!=='linear'||Math.abs(chart.scales.x.max-duration)>.1)return null;
  return chart.scales.x;
 }
 function secondsToX(seconds){const x=axis();return x?x.getPixelForValue(Math.max(0,Math.min(duration,seconds))):null}
 function xToSeconds(pixel){const x=axis();return x?Math.max(0,Math.min(duration,x.getValueForPixel(pixel))):null}
 function update(){
  const next=actualDuration();
  if(Math.abs(next-duration)>.1){duration=next;redrawTv()}
  if(!tvActive()){playhead.hidden=true;timeLabel.textContent='';return}
  const scale=axis();
  if(!scale){playhead.hidden=true;timeLabel.textContent='動画の長さを確認中…';return}
  const now=Math.max(0,Number(player.getCurrentTime?.())||0),shown=player.getPlayerState?.()===0?duration:Math.min(now,duration);
  const pixel=secondsToX(shown),r=canvas.getBoundingClientRect(),parent=map.getBoundingClientRect(),area=chart.chartArea,style=getComputedStyle(map);
  const sx=r.width/chart.width,sy=r.height/chart.height;
  Object.assign(playhead.style,{left:(r.left-parent.left-(parseFloat(style.borderLeftWidth)||0)+pixel*sx)+'px',top:(r.top-parent.top-(parseFloat(style.borderTopWidth)||0)+area.top*sy)+'px',height:((area.bottom-area.top)*sy)+'px',bottom:'auto',transform:'translateX(-50%)'});
  playhead.hidden=false;timeLabel.textContent='▶ '+fmt(Math.floor(shown));
 }
 window.PULSE_TV_AXIS=Object.freeze({
  duration:()=>duration,secondsToX,xToSeconds,
  loading(id){expectedVideoId=id;awaitingVideo=true;duration=0;playhead.hidden=true;redrawTv();if(tvActive())timeLabel.textContent='動画の長さを確認中…'},
  onReady(){awaitingVideo=false;update()},
  onStateChange(event){
   if(awaitingVideo&&[0,1,2,5].includes(event.data)&&event.target.getVideoData?.().video_id===expectedVideoId)awaitingVideo=false;
   update();
  }
 });
 canvas.addEventListener("click",event=>{
  if(!tvActive())return;
  if(!axis()||!player?.seekTo){announce("動画とマップの読み込みをお待ちください");return}
  const r=canvas.getBoundingClientRect(),area=chart.chartArea,x=(event.clientX-r.left)*chart.width/r.width,y=(event.clientY-r.top)*chart.height/r.height;
  if(x<area.left-1||x>area.right+1||y<area.top-1||y>area.bottom+1)return;
  const selected=xToSeconds(x);if(selected===null)return;
  const target=Math.max(0,Math.min(Math.floor(selected+1e-6),Math.max(0,Math.ceil(duration)-1)));
  try{player.seekTo(target,true);echoPlayed.clear();player.playVideo?.();announce(fmt(target)+'から再生')}
  catch{announce("動画の準備後にもう一度クリックしてください")}
 });
 document.addEventListener('pulse-view-mode',()=>{if(typeof chart!=='undefined'&&chart)draw(filteredEvents());update()});
 setInterval(update,250);
 update();
 document.addEventListener("keydown",event=>{if(event.key==="Escape"&&body.classList.contains("tv-mode")){event.preventDefault();if(!namePanel.hidden)closeName()}});
 if(new URLSearchParams(location.search).get("mode")==="tv")setMode(true);
})();
