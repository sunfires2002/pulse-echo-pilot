/* Explicit PC LAB only. Shared presentation preserves the existing player and data. */
(() => {
 const body=document.body,dock=document.getElementById("tvMapDock"),shell=document.getElementById("videoShell");
 const controls=document.createElement("nav");controls.id="labControls";controls.className="lab-only";controls.setAttribute("aria-label","PC LAB操作");
 controls.innerHTML='<strong>PC LAB 試作</strong><button class="btn" id="labMapToggle" type="button" aria-pressed="true">マップを隠す</button><button class="btn" id="labReset" type="button">位置・サイズを戻す</button><button class="btn" id="labToTv" type="button">テレビ鑑賞へ</button><button class="btn" id="labToReview" type="button">従来表示へ</button>';
 body.append(controls);
 const handle=document.createElement("div");handle.id="labMapHandle";handle.className="lab-only";handle.tabIndex=0;handle.textContent="反応マップ ─ ドラッグで移動";dock.prepend(handle);
 const resize=document.createElement("button");resize.id="labMapResize";resize.type="button";resize.className="lab-only";resize.setAttribute("aria-label","反応マップのサイズ変更");resize.textContent="↘";dock.append(resize);
 const tip=document.createElement("div");tip.id="labTooltip";tip.hidden=true;tip.setAttribute("role","tooltip");body.append(tip);
 let resizingFrame=0;
 const active=()=>body.classList.contains("lab-mode");
 function redraw(){if(resizingFrame)return;resizingFrame=requestAnimationFrame(()=>{resizingFrame=0;if(typeof chart!=="undefined"&&chart)chart.resize()})}
 function bounds(left,top,width,height){
  width=Math.min(Math.max(420,width),Math.max(1,innerWidth-16));height=Math.min(Math.max(220,height),Math.max(1,innerHeight-16));
  left=Math.max(8,Math.min(left,innerWidth-width-8));top=Math.max(8,Math.min(top,innerHeight-height-8));
  Object.assign(dock.style,{left:left+"px",top:top+"px",width:width+"px",height:height+"px"});tip.hidden=true;redraw();
 }
 function reset(){const width=Math.min(760,innerWidth-32),height=Math.min(300,innerHeight-100);bounds(24,Math.max(70,innerHeight-height-24),width,height)}
 function updateToggle(){const b=document.getElementById("labMapToggle");b.textContent=dock.hidden?"マップを表示":"マップを隠す";b.setAttribute("aria-pressed",String(!dock.hidden))}
 function activate(){window.PULSE_VIEW.setMode(true,"lab")}
 document.getElementById("labEnter").addEventListener("click",activate);
 document.getElementById("labToTv").addEventListener("click",()=>window.PULSE_VIEW.setMode(true));
 document.getElementById("labToReview").addEventListener("click",()=>window.PULSE_VIEW.setMode(false));
 document.getElementById("labReset").addEventListener("click",reset);
 document.getElementById("labMapToggle").addEventListener("click",()=>{dock.hidden=!dock.hidden;tip.hidden=true;updateToggle();redraw()});
 document.addEventListener("pulse-view-mode",()=>{
  tip.hidden=true;
  if(active()){body.append(dock);dock.hidden=false;reset();updateToggle()}
  else{shell.append(dock);dock.style.removeProperty("left");dock.style.removeProperty("top");dock.style.removeProperty("width");dock.style.removeProperty("height")}
 });
 function movable(element,isResize){
  let start=null;
  element.addEventListener("pointerdown",event=>{
   if(!active()||event.button!==0)return;
   const r=dock.getBoundingClientRect();start={id:event.pointerId,x:event.clientX,y:event.clientY,left:r.left,top:r.top,width:r.width,height:r.height};
   element.setPointerCapture(event.pointerId);event.preventDefault();tip.hidden=true;
  });
  element.addEventListener("pointermove",event=>{
   if(!start||event.pointerId!==start.id)return;
   const dx=event.clientX-start.x,dy=event.clientY-start.y;
   if(isResize)bounds(start.left,start.top,Math.min(start.width+dx,innerWidth-start.left-8),Math.min(start.height+dy,innerHeight-start.top-8));
   else bounds(start.left+dx,start.top+dy,start.width,start.height);
  });
  const end=()=>{start=null};element.addEventListener("pointerup",end);element.addEventListener("pointercancel",end);element.addEventListener("lostpointercapture",end);
  element.addEventListener("keydown",event=>{
   if(!active()||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
   event.preventDefault();const step=event.shiftKey?30:10,r=dock.getBoundingClientRect(),dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;
   if(isResize)bounds(r.left,r.top,r.width+dx,r.height+dy);else bounds(r.left+dx,r.top+dy,r.width,r.height);
  });
 }
 movable(handle,false);movable(resize,true);
 window.addEventListener("resize",()=>{if(active()){const r=dock.getBoundingClientRect();bounds(r.left,r.top,r.width,r.height)}});
 function tooltip(context){
  const model=context.tooltip;if(!active()||!model||model.opacity===0){tip.hidden=true;return}
  tip.replaceChildren();
  const title=document.createElement("strong");title.textContent=(model.title||[]).join(" ")+"分目";tip.append(title);
  (model.dataPoints||[]).forEach(point=>{const row=document.createElement("div");row.textContent=point.dataset.label+"："+point.formattedValue;row.style.borderLeft="4px solid "+point.dataset.borderColor;row.style.paddingLeft="8px";tip.append(row)});
  tip.hidden=false;
  const r=context.chart.canvas.getBoundingClientRect(),t=tip.getBoundingClientRect();
  const left=Math.max(8,Math.min(r.left+model.caretX*r.width/context.chart.width+12,innerWidth-t.width-8));
  const top=Math.max(8,Math.min(r.top+model.caretY*r.height/context.chart.height+12,innerHeight-t.height-8));
  tip.style.left=left+"px";tip.style.top=top+"px";
 }
 if(window.Chart)Chart.register({id:"pulsePcLab",beforeUpdate(instance){
  if(instance.canvas.id!=="chart")return;
  const lab=active();instance.options.maintainAspectRatio=!lab;
  instance.options.plugins.tooltip.enabled=!lab;instance.options.plugins.tooltip.external=lab?tooltip:null;
  instance.options.plugins.tooltip.mode=lab?"index":"nearest";instance.options.plugins.tooltip.intersect=!lab;
 }});
 document.getElementById("chart").addEventListener("mouseleave",()=>{tip.hidden=true});
 if(new URLSearchParams(location.search).get("mode")==="lab")activate();
})();
