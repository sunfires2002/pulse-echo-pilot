/* Television presentation only. Existing player and ECHO handlers remain in place. */
(() => {
 const body=document.body, shell=document.getElementById("videoShell");
 const map=document.querySelector(".heatmap"), toolbar=document.getElementById("tvToolbar");
 const enter=document.getElementById("tvEnter"), exit=document.getElementById("tvExit");
 const nameField=document.getElementById("userName"), namePanel=document.getElementById("tvNamePanel"), nameInput=document.getElementById("tvNameInput");
 const nameButton=document.getElementById("tvNameOpen"), status=document.getElementById("tvStatus");
 const storage={read(key){try{return localStorage.getItem(key)}catch{return null}},write(key,value){try{localStorage.setItem(key,value);return true}catch{return false}}};
 let statusTimer;
 function clearStatus(){clearTimeout(statusTimer);status.textContent=""}
 function announce(text){clearStatus();status.textContent=text;statusTimer=setTimeout(clearStatus,1800)}
 function refreshName(){nameButton.textContent="名前："+(nameField.value.trim()||"匿名")}
 const savedName=storage.read("pulse_echo_tv_name");if(savedName!==null&&!nameField.value.trim())nameField.value=savedName;
 refreshName();
 nameField.addEventListener("input",refreshName);
 function setLayout(value,persist=false){
  const layout=value==="large"?"large":"standard";body.dataset.tvLayout=layout;
  document.getElementById("tvStandard").setAttribute("aria-pressed",String(layout==="standard"));
  document.getElementById("tvLarge").setAttribute("aria-pressed",String(layout==="large"));
  if(persist&&!storage.write("pulse_echo_tv_layout",layout))announce("表示設定を保存できません。このページ内で適用します");
  requestAnimationFrame(()=>{window.dispatchEvent(new Event("resize"));if(typeof chart!=="undefined"&&chart)chart.resize()});
 }
 setLayout(storage.read("pulse_echo_tv_layout"));
 document.getElementById("tvStandard").addEventListener("click",()=>setLayout("standard",true));
 document.getElementById("tvLarge").addEventListener("click",()=>setLayout("large",true));
 nameButton.addEventListener("click",()=>{nameInput.value=nameField.value;namePanel.hidden=false;document.getElementById("tvStorageNotice").textContent="";nameInput.focus()});
 function closeName(){namePanel.hidden=true;nameButton.focus()}
 document.getElementById("tvNameCancel").addEventListener("click",closeName);
 document.getElementById("tvNameSave").addEventListener("click",()=>{
  nameField.value=nameInput.value.trim();refreshName();
  if(storage.write("pulse_echo_tv_name",nameField.value)){closeName();announce("名前を保存しました")}
  else document.getElementById("tvStorageNotice").textContent="ブラウザへの保存ができません。名前はこのページ内で適用しました。";
 });
 const placeholder=document.createComment("reaction map original position");
 map.before(placeholder);
 const dock=document.createElement("div");dock.id="tvMapDock";dock.hidden=true;shell.append(dock);
 const legend=document.createElement("div");legend.className="tv-reactions";legend.setAttribute("aria-label","反応マップの凡例兼投稿ボタン");
 const reactions=[
  ["🔥 ナイスプレー","🔥 ナイスプレー","#ff4757"],
  ["😫 惜しい","😫 惜しい","#8b5cf6"],
  ["😂 あちゃー","😅 あちゃー","#ffa502"],
  ["😲 マジで","😳 マジで","#2ed573"],
  ["🤖 AIにお任せ","🤖 AIにお任せ","#00cec9"]
 ];
 reactions.forEach(([label,kind,color])=>{
  const button=document.createElement("button");button.className="tv-react";button.type="button";
  button.dataset.tvKind=kind;button.style.setProperty("--reaction-color",color);button.textContent=label;button.setAttribute("aria-label",label);
  legend.append(button);
 });
 dock.append(legend);shell.append(toolbar);
 // Hide the canvas legend only in TV mode: the five buttons serve as its legend.
 if(window.Chart)Chart.register({id:"pulseTvLegend",beforeUpdate(instance){
  if(instance.canvas.id==="chart")instance.options.plugins.legend.display=body.classList.contains("tv-mode")?false:true;
 }});
 function setMode(active){
  clearStatus();namePanel.hidden=true;refreshName();
  body.classList.toggle("tv-mode",active);toolbar.hidden=!active;dock.hidden=!active;
  if(active)dock.append(map);else placeholder.after(map);
  const url=new URL(location.href);if(active)url.searchParams.set("mode","tv");else url.searchParams.delete("mode");
  history.replaceState(null,"",url);
  requestAnimationFrame(()=>{window.dispatchEvent(new Event("resize"));if(typeof chart!=="undefined"&&chart){chart.update("none");chart.resize()}});
  (active?exit:enter).focus({preventScroll:true});
 }
 enter.addEventListener("click",()=>setMode(true));exit.addEventListener("click",()=>setMode(false));
 legend.querySelectorAll(".tv-react").forEach(button=>button.addEventListener("click",()=>{
  const source=button.dataset.tvSource?document.getElementById(button.dataset.tvSource):
   [...document.querySelectorAll(".react[data-kind]")].find(el=>el.dataset.kind===button.dataset.tvKind);
  if(!source)return;
  source.click();
  announce(button.getAttribute("aria-label")+"を選択");
 }));
 document.addEventListener("keydown",event=>{if(event.key==="Escape"&&body.classList.contains("tv-mode")){event.preventDefault();if(!namePanel.hidden)closeName();else setMode(false)}});
 if(new URLSearchParams(location.search).get("mode")==="tv")setMode(true);
})();
