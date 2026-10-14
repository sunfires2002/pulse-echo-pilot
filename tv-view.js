/* Television presentation only. Existing player and ECHO handlers remain in place. */
(() => {
 const body=document.body, shell=document.getElementById("videoShell");
 const map=document.querySelector(".heatmap"), toolbar=document.getElementById("tvToolbar");
 const enter=document.getElementById("tvEnter"), exit=document.getElementById("tvExit");
 const placeholder=document.createComment("reaction map original position");
 map.before(placeholder);
 const dock=document.createElement("div");dock.id="tvMapDock";dock.hidden=true;shell.append(dock);
 function setMode(active){
  body.classList.toggle("tv-mode",active);toolbar.hidden=!active;dock.hidden=!active;
  if(active)dock.append(map);else placeholder.after(map);
  const url=new URL(location.href);if(active)url.searchParams.set("mode","tv");else url.searchParams.delete("mode");
  history.replaceState(null,"",url);
  requestAnimationFrame(()=>{window.dispatchEvent(new Event("resize"));if(typeof chart!=="undefined"&&chart)chart.resize()});
  (active?exit:enter).focus({preventScroll:true});
 }
 enter.addEventListener("click",()=>setMode(true));exit.addEventListener("click",()=>setMode(false));
 toolbar.querySelectorAll(".tv-react").forEach(button=>button.addEventListener("click",()=>{
  const source=button.dataset.tvSource?document.getElementById(button.dataset.tvSource):
   [...document.querySelectorAll(".react[data-kind]")].find(el=>el.dataset.kind===button.dataset.tvKind);
  if(!source)return;
  source.click();
  document.getElementById("tvStatus").textContent=button.getAttribute("aria-label")+"を選択";
 }));
 document.addEventListener("keydown",event=>{if(event.key==="Escape"&&body.classList.contains("tv-mode")){event.preventDefault();setMode(false)}});
 if(new URLSearchParams(location.search).get("mode")==="tv")setMode(true);
})();
