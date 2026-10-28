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
  legend.append(button);
 });
 legend.prepend(nameButton);dock.append(legend);shell.append(toolbar);
 // Hide the canvas legend only in TV mode: the five buttons serve as its legend.
 if(window.Chart)Chart.register({id:"pulseTvLegend",beforeUpdate(instance){
  if(instance.canvas.id==="chart"){
   const active=body.classList.contains("tv-mode");
   instance.options.plugins.legend.display=!active;
   // Thirty minute-wide bands, retaining the original minute bins and counts.
   instance.options.scales.x.offset=active;
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
 // Map navigation uses the plot width, not the canvas margins or label pixels.
 const canvas=document.getElementById("chart");
 const playhead=document.createElement("div");playhead.className="tv-playhead";playhead.hidden=true;map.append(playhead);
 const timeLabel=document.createElement("span");timeLabel.className="tv-map-time";toolbar.append(timeLabel);
 canvas.addEventListener("click",event=>{
  if(!body.classList.contains("tv-mode"))return;
  if(typeof chart==="undefined"||!chart?.chartArea||!player?.seekTo){announce("動画とマップの読み込みをお待ちください");return}
  const rect=canvas.getBoundingClientRect(),area=chart.chartArea;
  const x=(event.clientX-rect.left)*chart.width/rect.width;
  if(area.right<=area.left||x<area.left-1||x>area.right+1)return;
  const selected=Math.min(1,Math.max(0,(x-area.left)/(area.right-area.left)))*1800;
  let target=Math.max(0,Math.floor(selected)-10);
  const duration=Number(player.getDuration?.())||0;
  if(duration>0)target=Math.min(target,Math.max(0,Math.floor(duration)-1));
  try{
   player.seekTo(target,true);
   // Replaying a scene should also replay its existing ECHO, without a new query.
   echoPlayed.clear();
   if(player.playVideo)player.playVideo();
   announce(`${Math.floor(target/60)}:${String(target%60).padStart(2,"0")}から再生`);
  }catch{announce("動画の準備後にもう一度クリックしてください")}
 });
 setInterval(()=>{
  if(!body.classList.contains("tv-mode")){playhead.hidden=true;return}
  if(typeof chart==="undefined"||!chart?.chartArea||!player?.getCurrentTime)return;
  const now=Number(player.getCurrentTime())||0,area=chart.chartArea;
  const scale=canvas.clientWidth/chart.width;
  playhead.style.left=(canvas.offsetLeft+(area.left+Math.min(1,Math.max(0,now/1800))*(area.right-area.left))*scale)+"px";
  playhead.hidden=false;
  timeLabel.textContent=`▶ ${Math.floor(now/60)}:${String(Math.floor(now)%60).padStart(2,"0")}${now>=1800?"（マップ範囲外）":""}`;
 },500);
 document.addEventListener("keydown",event=>{if(event.key==="Escape"&&body.classList.contains("tv-mode")){event.preventDefault();if(!namePanel.hidden)closeName()}});
 if(new URLSearchParams(location.search).get("mode")==="tv")setMode(true);
})();
