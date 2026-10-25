/* Standard desktop viewing. Shared presentation preserves the existing player and data. */
(() => {
 const body=document.body,dock=document.getElementById("tvMapDock"),shell=document.getElementById("videoShell");
 const controls=document.createElement("nav");controls.id="labControls";controls.className="lab-only";controls.setAttribute("aria-label","PC LAB操作");
 controls.innerHTML='<strong>PC LAB 試作</strong><button class="btn" id="labMapToggle" type="button" aria-pressed="true">マップを隠す</button><button class="btn" id="labReset" type="button">位置・サイズを戻す</button><button class="btn" id="labToTv" type="button">テレビ鑑賞へ</button><button class="btn" id="labToReview" type="button">従来表示へ</button>';
 body.append(controls);
 const menu=document.createElement("button");menu.id="labMenuToggle";menu.className="lab-only btn";menu.type="button";menu.textContent="LABメニュー";menu.setAttribute("aria-expanded","false");menu.setAttribute("aria-controls","labControls");body.append(menu);controls.classList.add("is-collapsed");
 menu.onclick=()=>{const collapsed=controls.classList.toggle("is-collapsed");menu.setAttribute("aria-expanded",String(!collapsed))};
 const back=document.createElement("button");back.id="labReturn";back.className="btn";back.type="button";back.textContent="PC LABへ戻る";back.hidden=true;body.append(back);
  const tacticsExit=document.createElement("button");tacticsExit.id="labTacticsExit";tacticsExit.className="lab-only btn";tacticsExit.type="button";tacticsExit.textContent="戦術レビューを終了";tacticsExit.hidden=true;body.append(tacticsExit);
  function syncTacticsExit(){tacticsExit.hidden=!(body.classList.contains("tactics-available")&&body.classList.contains("tactics-open"))}
  tacticsExit.onclick=()=>document.getElementById("tacticToggle")?.click();
  const tacticsObserver=new MutationObserver(syncTacticsExit);tacticsObserver.observe(body,{attributes:true,attributeFilter:["class"]});
  document.addEventListener("pulse-view-mode",syncTacticsExit);
  syncTacticsExit();
 let returnFromTv=false;
 back.onclick=()=>window.PULSE_VIEW.setMode(true,"lab");
 document.addEventListener("pulse-view-mode",event=>{back.hidden=!(returnFromTv&&event.detail.mode==="tv");if(event.detail.mode==="review")returnFromTv=false});
 const handle=document.createElement("div");handle.id="labMapHandle";handle.className="lab-only";handle.tabIndex=0;handle.innerHTML='<span class="lab-grip-line"><span class="lab-grip-mark" aria-hidden="true">⠿</span><span class="lab-grip-title">PULSE</span></span><small>みんなの熱量</small>';dock.prepend(handle);
 const resize=document.createElement("button");resize.id="labMapResize";resize.type="button";resize.className="lab-only";resize.setAttribute("aria-label","反応マップのサイズ変更");resize.textContent="↘";dock.append(resize);
 const tip=document.createElement("div");tip.id="labTooltip";tip.hidden=true;tip.setAttribute("role","tooltip");body.append(tip);
 let resizingFrame=0;
 const active=()=>body.classList.contains("lab-mode");
 // Move the original elements, preserving their input state and event handlers.
 const panels=[];
 const layoutKey="pulse_echo_pc_lab_layout_v1",entries=[];
 let layout={},restoring=false,storageWarning=false,docked=false,dockingReady=false,syncingDock=false,dockCandidate=false;
 try{const saved=JSON.parse(localStorage.getItem(layoutKey)||"null");if(saved?.version===1&&saved.panels&&typeof saved.panels==="object"){layout=saved.panels;docked=saved.docked===true}}catch{storageWarning=true}
 const notice=document.createElement("span");notice.id="labStorageNotice";notice.setAttribute("role","status");controls.append(notice);
 function saveLayout(){try{localStorage.setItem(layoutKey,JSON.stringify({version:1,panels:layout,docked}));notice.textContent=""}catch{storageWarning=true;notice.textContent="配置を保存できません。このページ内では利用できます。"}}
 function remember(id,panel){if(!active()||restoring)return;const values=['left','top','width','height'].map(k=>parseFloat(panel.style[k]));if(values.every(Number.isFinite)){Object.assign(layout[id],Object.fromEntries(['left','top','width','height'].map((k,i)=>[k,values[i]])));saveLayout()}}
 function applyEntry(entry){
  const value=layout[entry.id];restoring=true;try{entry.fit(value.left,value.top,value.width,value.height)}finally{restoring=false}
  entry.panel.style.setProperty('--lab-bg-alpha',String((100-value.transparency)/100));entry.panel.hidden=!value.visible;if(!value.visible)closeDetails();
  entry.toggle.setAttribute('aria-pressed',String(value.visible));if(entry.id==='map')updateToggle();if(dockingReady)syncDock();
 }
 function register(id,panel,title,fit,initial,toggle,transparency){
  const defaultValue=()=>{const [left,top,width,height]=initial();return{left,top,width,height,visible:true,transparency}};
  const candidate=layout[id],valid=candidate&&['left','top','width','height','transparency'].every(k=>Number.isFinite(candidate[k]))&&candidate.width>0&&candidate.height>0&&candidate.transparency>=0&&candidate.transparency<=100&&typeof candidate.visible==='boolean';
  layout[id]=valid?{...candidate}:defaultValue();
  const entry={id,panel,fit,initial:defaultValue,toggle};entries.push(entry);
  function front(){if(!active())return;entries.forEach(e=>e.panel.style.zIndex='71');panel.style.zIndex='72';if(dockingReady&&effectiveDock()&&(panel===dock||panel.id==='labReactions')){dock.style.zIndex='72';barEntry.panel.style.zIndex='72'}}
  panel.addEventListener('pointerdown',front);panel.addEventListener('focusin',front);
  const label=document.createElement('label');label.className='lab-opacity';label.textContent=title+' 背景透明度 ';
  const range=document.createElement('input');range.type='range';range.min='0';range.max='100';range.step='1';range.value=layout[id].transparency;range.id='labOpacity-'+id;range.setAttribute('aria-label',title+'の背景透明度');
  const output=document.createElement('output');output.textContent=range.value+'％';range.oninput=()=>{layout[id].transparency=Number(range.value);output.textContent=range.value+'％';panel.style.setProperty('--lab-bg-alpha',String((100-Number(range.value))/100));saveLayout()};label.append(range,output);controls.append(label);entry.range=range;entry.output=output;
  return entry;
 }
 const clearButton=document.createElement('button');clearButton.id='labClearAll';clearButton.className='lab-only btn';clearButton.type='button';clearButton.textContent='動画だけ表示';clearButton.setAttribute('aria-pressed','false');body.append(clearButton);
 const cleanMic=document.createElement('button');cleanMic.id='labCleanMic';cleanMic.className='lab-only';cleanMic.type='button';cleanMic.textContent='🎙';cleanMic.hidden=true;cleanMic.setAttribute('aria-label','音声入力中。クリックして停止');cleanMic.title='音声入力を停止';body.append(cleanMic);
 const voiceButton=document.getElementById('voiceBtn'),activeVoiceStates=new Set(['starting','listening','waiting','stopping']);
 function syncCleanMic(){const state=voiceButton?.dataset.voiceState||'idle',listening=activeVoiceStates.has(state);cleanMic.hidden=!(active()&&body.classList.contains('lab-clean')&&listening);cleanMic.setAttribute('aria-label',state==='stopping'?'音声入力を停止中':'音声入力中。クリックして停止');cleanMic.title=state==='stopping'?'音声入力を停止中':'音声入力を停止'}
 cleanMic.onclick=()=>{if(!cleanMic.hidden&&voiceButton&&!voiceButton.disabled&&activeVoiceStates.has(voiceButton.dataset.voiceState))voiceButton.click()};
 const voiceStateObserver=voiceButton?new MutationObserver(syncCleanMic):null;if(voiceStateObserver)voiceStateObserver.observe(voiceButton,{attributes:true,attributeFilter:['data-voice-state']});
 const cleanStateObserver=new MutationObserver(syncCleanMic);cleanStateObserver.observe(body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('pulse-voice-echo-saved',()=>{if(cleanMic.hidden)return;cleanMic.classList.remove('is-flashing');void cleanMic.offsetWidth;cleanMic.classList.add('is-flashing');setTimeout(()=>cleanMic.classList.remove('is-flashing'),900)});
 syncCleanMic();
 clearButton.onclick=()=>{const hidden=body.classList.toggle('lab-clean');clearButton.textContent=hidden?'パネルを復元':'動画だけ表示';clearButton.setAttribute('aria-pressed',String(hidden));tip.hidden=true;clearDockCandidate();closeDetails();document.getElementById('tvNamePanel').hidden=true;if(!hidden)redraw()};
 document.addEventListener('pulse-view-mode',()=>{body.classList.remove('lab-clean');clearButton.textContent='動画だけ表示';clearButton.setAttribute('aria-pressed','false');if(active()){controls.classList.add('is-collapsed');menu.setAttribute('aria-expanded','false');if(storageWarning)notice.textContent='保存設定を利用できない場合は標準配置を使います。'}});

 function makePanel(id,title,selector,initial,fixed=false,description=''){
  const source=document.querySelector(selector),anchor=document.createComment(id+" original position");source.before(anchor);
  const panel=document.createElement("section");panel.id=id;panel.className="lab-only lab-panel";panel.hidden=true;
  const grip=document.createElement("div");grip.className="lab-panel-grip";grip.tabIndex=0;grip.innerHTML=`<span class="lab-grip-line"><span class="lab-grip-mark" aria-hidden="true">⠿</span><span class="lab-grip-title">${title}</span></span>${description?`<small>${description}</small>`:''}`;
  const content=document.createElement("div");content.className="lab-panel-content";
  const corner=document.createElement("button");corner.className="lab-panel-resize";corner.type="button";corner.textContent="↘";corner.setAttribute("aria-label",title+"のサイズ変更");
  panel.append(grip,content);if(!fixed)panel.append(corner);body.append(panel);
  const toggle=document.createElement("button");toggle.className="btn";toggle.type="button";toggle.textContent=title;toggle.setAttribute("aria-pressed","true");controls.insertBefore(toggle,document.getElementById("labReset"));
  function fit(left,top,width,height){
   const floor=8;
   if(fixed){width=effectiveDock()?Math.min(720,parseFloat(dock.style.width)||720):Math.min(720,Math.max(1,innerWidth-16));height=barHeight(width)}
   const minimums={labPosting:[300,290],labTimeline:[250,140],labReactions:[610,84],labMatchLog:[310,160]};
   const [minWidth,minHeight]=minimums[id]||[280,140];
   width=Math.min(Math.max(fixed?1:minWidth,width),Math.max(1,innerWidth-16));height=Math.min(Math.max(fixed?1:minHeight,height),Math.max(1,innerHeight-floor-8));
   Object.assign(panel.style,{left:Math.max(8,Math.min(left,innerWidth-width-8))+"px",top:Math.max(floor,Math.min(top,innerHeight-height-8))+"px",width:width+"px",height:height+"px"});remember(id,panel);
  }
  toggle.onclick=()=>{layout[id].visible=!layout[id].visible;applyEntry(savedEntry);saveLayout()};
  for(const [element,resize] of (fixed?[[grip,false]]:[[grip,false],[corner,true]])){
   let start;
   element.addEventListener("pointerdown",e=>{if(!active()||e.button!==0)return;const r=panel.getBoundingClientRect();start={id:e.pointerId,x:e.clientX,y:e.clientY,r,moved:false,map:fixed&&effectiveDock()?dock.getBoundingClientRect():null};element.setPointerCapture(e.pointerId);e.preventDefault()});
   element.addEventListener("pointermove",e=>{if(!start||e.pointerId!==start.id)return;const {r}=start,dx=e.clientX-start.x,dy=e.clientY-start.y;start.moved=start.moved||Math.hypot(dx,dy)>=4;if(start.map)bounds(start.map.left+dx,start.map.top+dy,start.map.width,start.map.height);else fit(r.left+(resize?0:dx),r.top+(resize?0:dy),r.width+(resize?dx:0),r.height+(resize?dy:0));if(fixed&&!docked&&start.moved)updateDockCandidate(e.clientX,e.clientY)});
   for(const event of ["pointerup","pointercancel","lostpointercapture"])element.addEventListener(event,e=>{if(start&&start.moved&&fixed&&event==='pointerup'&&!docked){updateDockCandidate(e.clientX,e.clientY);if(dockCandidate)joinDock()}start=null;clearDockCandidate()});
   element.addEventListener("keydown",e=>{if(!active()||!e.key.startsWith("Arrow"))return;e.preventDefault();const r=panel.getBoundingClientRect(),dx=e.key==="ArrowRight"?10:e.key==="ArrowLeft"?-10:0,dy=e.key==="ArrowDown"?10:e.key==="ArrowUp"?-10:0;if(fixed&&effectiveDock()){const m=dock.getBoundingClientRect();bounds(m.left+dx,m.top+dy,m.width,m.height)}else fit(r.left+(resize?0:dx),r.top+(resize?0:dy),r.width+(resize?dx:0),r.height+(resize?dy:0))});
  }
  const savedEntry=register(id,panel,title,fit,initial,toggle,72);
  const entry={panel,update(){if(active())applyEntry(savedEntry)},mode(){if(active()){content.append(source);applyEntry(savedEntry)}else{anchor.after(source);panel.hidden=true}}};
  panels.push(entry);return savedEntry;
 }
 makePanel("labPosting","ECHO+",".controls",()=>[16,130,360,350],false,"声・ひとこと");
 makePanel("labTimeline","REACT",".timeline-card",()=>[innerWidth-316,56,300,240],false,"みんなの反応");
 const goalLog=document.createElement('section');goalLog.className='lab-only lab-goal-log';goalLog.innerHTML='<div class="lab-goal-warning">仮データ・仮配色</div><div class="lab-goal-list"></div>';body.append(goalLog);
 const goalRows=[{team:'SUNFIRES',n:1,home:1,away:0,color:'#00cec9'},{team:'8motion',n:1,home:1,away:1,color:'#ff9b50'},{team:'SUNFIRES',n:2,home:2,away:1,color:'#00cec9'},{team:'8motion',n:2,home:2,away:2,color:'#ff9b50'}];
 const goalList=goalLog.querySelector('.lab-goal-list');goalRows.forEach(row=>{const item=document.createElement('div');item.className='lab-goal-row';item.style.setProperty('--goal-color',row.color);item.innerHTML=`<strong>${row.team}</strong><span>GOAL ${['','①','②','③','④'][row.n]}</span><b>${row.home}–${row.away}</b>`;goalList.append(item)});
 goalLog.dataset.labPrototype='true';
 // The prototype panel is created only inside PC LAB; it has no jump or data-writing behavior.
 const goalPanel=makePanel('labMatchLog','MATCH LOG','.lab-goal-log',()=>[16,510,340,260],false,'押すとゴールの場面へ');
 goalPanel.panel.dataset.mockOnly='true';
 document.getElementById("labReset").textContent="標準配置に戻す";
 document.getElementById("labReset").addEventListener("click",()=>{docked=false;clearDockCandidate();entries.forEach(entry=>{layout[entry.id]=entry.initial();entry.range.value=layout[entry.id].transparency;entry.output.textContent=entry.range.value+'％';applyEntry(entry)});saveLayout()});
 window.addEventListener("resize",()=>panels.forEach(p=>p.update()));
 document.addEventListener("pulse-view-mode",()=>panels.forEach(p=>p.mode()));
 function redraw(){if(resizingFrame)return;resizingFrame=requestAnimationFrame(()=>{resizingFrame=0;if(typeof chart!=="undefined"&&chart)chart.resize()})}
 function bounds(left,top,width,height){
  const floor=8;
  width=Math.min(Math.max(420,width),Math.max(1,innerWidth-16));height=Math.min(Math.max(160,height),Math.max(1,innerHeight-floor-8-(effectiveDock()?barHeight(Math.min(720,width)):0)));
  left=Math.max(8,Math.min(left,innerWidth-width-8));top=Math.max(floor,Math.min(top,innerHeight-height-8-(effectiveDock()?barHeight(Math.min(720,width)):0)));
  Object.assign(dock.style,{left:left+"px",top:top+"px",width:width+"px",height:height+"px"});tip.hidden=true;redraw();remember("map",dock);if(dockingReady&&!syncingDock)syncDock();
 }
 function mapInitial(){const width=Math.min(1200,innerWidth-32),height=Math.min(180,innerHeight-32);return[(innerWidth-width)/2,innerHeight-height-16,width,height]}
 const mapEntry=register("map",dock,"反応マップ",bounds,mapInitial,document.getElementById("labMapToggle"),78);
 function updateToggle(){const b=document.getElementById("labMapToggle");b.textContent='PULSE';b.setAttribute("aria-pressed",String(!dock.hidden))}
 function activate(){window.PULSE_VIEW.setMode(true,"lab")}
 document.getElementById("labEnter").addEventListener("click",activate);
 document.getElementById("labToTv").addEventListener("click",()=>{returnFromTv=true;window.PULSE_VIEW.setMode(true)});
 document.getElementById("labToReview").addEventListener("click",()=>window.PULSE_VIEW.setMode(false));

 document.getElementById("labMapToggle").addEventListener("click",()=>{layout.map.visible=!layout.map.visible;applyEntry(mapEntry);if(docked&&dock.hidden)splitDock(false);saveLayout();tip.hidden=true;redraw()});
 document.addEventListener("pulse-view-mode",()=>{
  tip.hidden=true;
  if(active()){body.append(dock);applyEntry(mapEntry)}
  else{shell.append(dock);dock.style.removeProperty("left");dock.style.removeProperty("top");dock.style.removeProperty("width");dock.style.removeProperty("height")}
 });
 function movable(element,isResize){
  let start=null;
  element.addEventListener("pointerdown",event=>{
   if(!active()||event.button!==0)return;
   const r=dock.getBoundingClientRect();start={id:event.pointerId,x:event.clientX,y:event.clientY,left:r.left,top:r.top,width:r.width,height:r.height};
   element.setPointerCapture(event.pointerId);event.preventDefault();tip.hidden=true;closeDetails();
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
 window.addEventListener("resize",()=>{if(active()){applyEntry(mapEntry)}});
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

 // LAB reaction bar: relocate the original controls; never clone posting handlers.
 const reactionSource=document.createElement('div');reactionSource.className='lab-reaction-source';reactionSource.hidden=true;body.append(reactionSource);
 const reactions=[document.getElementById('tvNameOpen'),...document.querySelectorAll('.controls .react[data-kind]')];
 const origins=reactions.map(node=>{const anchor=document.createComment('LAB reaction original');node.before(anchor);return{node,anchor}});
 const barEntry=makePanel('labReactions','ECHO','.lab-reaction-source',()=>[Math.max(8,(innerWidth-720)/2),Math.max(8,innerHeight-130),720,88],true,'反応する');
 barEntry.panel.classList.add('lab-reaction-bar');
 const splitButton=document.createElement('button');splitButton.id='labUndock';splitButton.type='button';splitButton.className='btn';splitButton.textContent='分離';splitButton.hidden=true;barEntry.panel.querySelector('.lab-panel-grip').after(splitButton);
 splitButton.onclick=()=>splitDock(true);
 function barHeight(width){const columns=Math.max(1,Math.floor((width-16+6)/118)),rows=Math.ceil(5/columns);return 74+rows*40+(rows-1)*6}
 function effectiveDock(){return dockingReady&&docked&&active()&&!dock.hidden&&!barEntry.panel.hidden}
 function clearDockCandidate(){dockCandidate=false;dock.classList.remove('lab-dock-candidate')}
 function updateDockCandidate(x,y){
  const r=dock.getBoundingClientRect();dockCandidate=active()&&!docked&&!dock.hidden&&!barEntry.panel.hidden&&!body.classList.contains('lab-clean')&&x>=r.left+12&&x<=r.right-12&&Math.abs(y-r.bottom)<=24;
  dock.classList.toggle('lab-dock-candidate',dockCandidate);
 }
 function syncDock(){
  if(!dockingReady||syncingDock)return;syncingDock=true;
  const linked=effectiveDock();dock.classList.toggle('lab-map-docked',linked);barEntry.panel.classList.toggle('lab-bar-docked',linked);splitButton.hidden=!linked;
  if(linked){const previous=restoring;restoring=true;try{bounds(parseFloat(dock.style.left),parseFloat(dock.style.top),parseFloat(dock.style.width),parseFloat(dock.style.height));barEntry.fit(parseFloat(dock.style.left),parseFloat(dock.style.top)+parseFloat(dock.style.height),0,0)}finally{restoring=previous}}
  syncingDock=false;
 }
 function joinDock(){docked=true;clearDockCandidate();closeDetails();syncDock();remember('map',dock);saveLayout()}
 function splitDock(near){
  const r=barEntry.panel.getBoundingClientRect(),m=dock.getBoundingClientRect();docked=false;clearDockCandidate();syncDock();closeDetails();
  barEntry.fit(near?m.left+16:r.left,near?m.bottom+12:r.top,0,0);saveLayout();
 }
 dockingReady=true;
 document.addEventListener('pulse-view-mode',()=>{clearDockCandidate();syncDock()});

 const detail=document.createElement('section');detail.id='labNicePopup';detail.className='lab-only';detail.hidden=true;detail.setAttribute('aria-label','ナイスの詳細');body.append(detail);
 const options=document.getElementById('niceOptions'),optionsAnchor=document.createComment('LAB nice options original');options.before(optionsAnchor);
 const detailClose=document.createElement('button');detailClose.type='button';detailClose.className='btn';detailClose.textContent='閉じる';detailClose.onclick=closeDetails;detail.append(detailClose);
 const namePanel=document.getElementById('tvNamePanel'),nameAnchor=document.createComment('LAB name original');namePanel.before(nameAnchor);
 function closeDetails(){const wasOpen=!detail.hidden;detail.hidden=true;if(active()||wasOpen)hideNiceOptions()}
 function showDetails(){
  if(!active()||barEntry.panel.hidden||body.classList.contains('lab-clean'))return;
  detail.hidden=false;const button=document.getElementById('niceButton').getBoundingClientRect();
  const width=Math.min(420,Math.max(1,innerWidth-16));detail.style.width=width+'px';
  const height=detail.getBoundingClientRect().height;
  detail.style.left=Math.max(8,Math.min(button.left,innerWidth-width-8))+'px';
  detail.style.top=Math.max(8,Math.min(button.bottom+8+height<=innerHeight-8?button.bottom+8:button.top-height-8,innerHeight-height-8))+'px';
 }
 document.getElementById('niceButton').addEventListener('click',showDetails);
 options.querySelectorAll('button').forEach(button=>button.addEventListener('click',closeDetails));
 reactions.filter(node=>node.id!=='niceButton'&&node.id!=='tvNameOpen').forEach(button=>button.addEventListener('click',()=>{if(active())closeDetails()}));
 barEntry.panel.querySelector('.lab-panel-grip').addEventListener('pointerdown',closeDetails);
 document.addEventListener('keydown',event=>{if(active()&&event.key==='Escape')closeDetails()});
 window.addEventListener('resize',()=>{if(active())closeDetails()});
 document.addEventListener('pulse-view-mode',()=>{
  closeDetails();
  if(active()){
   origins.forEach(({node})=>reactionSource.append(node));reactionSource.hidden=false;detail.append(options);body.append(namePanel);applyEntry(barEntry);
  }else{
   origins.forEach(({node,anchor})=>anchor.after(node));reactionSource.hidden=true;optionsAnchor.after(options);nameAnchor.after(namePanel);
  }
 });

 // Conservative desktop default: dimensions never determine the device category.
 const entryUrl=new URL(location.href),requestedMode=entryUrl.searchParams.get('mode');
 const ua=navigator.userAgent;
 const mobileDevice=/Android|iPhone|iPad|iPod|Silk|Fire TV|AFT/i.test(ua)||( /Macintosh/.test(ua)&&navigator.maxTouchPoints>0)||navigator.userAgentData?.mobile===true;
 const desktop=!mobileDevice&&/Windows NT|Macintosh|X11|CrOS|Linux/.test(ua)&&matchMedia('(any-pointer: fine)').matches&&matchMedia('(any-hover: hover)').matches;
 body.classList.toggle('pc-default',desktop);
 // Standard PC presentation only: retain other devices' existing controls/text.
 if(desktop){
  controls.querySelector('strong').textContent='PC鑑賞';
  controls.setAttribute('aria-label','PC鑑賞の表示設定');
  menu.textContent='表示メニュー';document.getElementById('labEnter').textContent='PC鑑賞';
  const label=document.createElement('label');label.textContent='動画 ';label.className='lab-video-choice';
  const choice=document.createElement('select');choice.id='pcVideoPart';choice.className='input';choice.setAttribute('aria-label','再生する動画');label.append(choice);controls.insertBefore(label,document.getElementById('labReset'));
  const sourceHome=document.querySelector('.site-header .navlinks a');
  const home=document.createElement('a');home.id='pcMatchList';home.className='btn';home.href=sourceHome.href;home.textContent=sourceHome.textContent;controls.append(home);
  const tabs=document.getElementById('tabs');
  function syncVideoChoices(){
   const buttons=[...tabs.querySelectorAll('.tab')],signature=buttons.map(button=>button.dataset.label+'|'+button.dataset.video).join('\n');
   if(choice.dataset.signature!==signature){choice.replaceChildren(...buttons.map((button,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=button.textContent;return option}));choice.dataset.signature=signature}
   choice.value=String(buttons.findIndex(button=>button.classList.contains('active')));choice.disabled=buttons.length<2;
  }
  choice.onchange=()=>{const button=tabs.querySelectorAll('.tab')[Number(choice.value)];if(button)button.click()};
  new MutationObserver(syncVideoChoices).observe(tabs,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});syncVideoChoices();
  installPcMenu(label,home);
 }

 // Desktop menu only: reuse the original controls and their handlers.
 function installPcMenu(videoChoice,home){
  const wrapper=document.createElement('div');wrapper.id='pcPulseMenu';body.append(wrapper);wrapper.append(menu,controls);
  menu.replaceChildren();
  const icon=document.createElement('img');icon.src='assets/pulse-echo-icon.png';icon.alt='';icon.width=32;icon.height=32;
  const title=document.createElement('span');title.textContent='PULSE ECHO';
  const gear=document.createElement('span');gear.textContent='⚙';gear.setAttribute('aria-hidden','true');
  menu.append(icon,title,gear);menu.setAttribute('aria-label','PULSE ECHO メニュー');menu.title='クリックで開閉・ドラッグで移動（Alt＋矢印キーでも移動）';
  controls.setAttribute('aria-label','PULSE ECHO 操作メニュー');
  function group(title){const section=document.createElement('section'),heading=document.createElement('h2');heading.textContent=title;section.append(heading);return section}
  const modes=group('鑑賞モード'),settings=group('表示・設定');
  const pc=document.createElement('button');pc.id='pcViewing';pc.type='button';pc.className='btn';pc.textContent='PC鑑賞';
  const tv=document.getElementById('labToTv');tv.textContent='テレビ鑑賞';
  const modeButtons=document.createElement('div');modeButtons.className='pc-menu-modes';modeButtons.append(pc,tv,clearButton);modes.append(modeButtons,videoChoice,home);
  const visibility=document.createElement('div');visibility.className='pc-menu-visibility';
  const posting=entries.find(entry=>entry.id==='labPosting');
  posting.toggle.textContent='ECHO+';
  posting.panel.querySelector('.lab-panel-resize').setAttribute('aria-label','ECHO+のサイズ変更');
  posting.range.setAttribute('aria-label','ECHO+の背景透明度');posting.range.closest('label').firstChild.textContent='ECHO+ 背景透明度 ';
  const panelNames={map:'PULSE',labReactions:'ECHO',labPosting:'ECHO+',labTimeline:'REACT',labMatchLog:'MATCH LOG'};
  const descriptions={map:'みんなの熱量',labReactions:'反応する',labPosting:'声・ひとこと',labTimeline:'みんなの反応',labMatchLog:'押すとゴールの場面へ'};
  entries.forEach(entry=>{const title=panelNames[entry.id]||entry.id,grip=entry.id==='map'?document.getElementById('labMapHandle'):entry.panel.querySelector('.lab-panel-grip');entry.toggle.textContent=title;entry.toggle.classList.add('lab-visibility-'+entry.id);grip.querySelector('.lab-grip-title').textContent=title;grip.querySelector('small')?.remove();if(descriptions[entry.id]){const small=document.createElement('small');small.textContent=descriptions[entry.id];grip.append(small)}if(entry.range){entry.range.setAttribute('aria-label',title+'の背景透明度');entry.range.closest('label').firstChild.textContent=title+' 背景透明度 '}});
  const nameButton=document.getElementById('tvNameOpen');
  const updateNameLabel=()=>{const name=window.PULSE_PROFILE?.getName()||'匿名';nameButton.textContent='名前：'+name;nameButton.title='クリックして名前を変更';nameButton.setAttribute('aria-label','名前：'+name+'。クリックして変更')};
  updateNameLabel();document.addEventListener('pulse-profile-name-changed',updateNameLabel);
  entries.forEach(entry=>{visibility.append(entry.toggle);entry.toggle.title='パネルの表示／非表示'});
  const opacity=document.createElement('details');opacity.id='pcOpacitySettings';
  const summary=document.createElement('summary');summary.textContent='⚙ 透明度';opacity.append(summary);
  entries.forEach(entry=>opacity.append(entry.range.closest('label')));
  const screenInfo=group('画面情報');screenInfo.id='pcScreenInfo';
  const screenSummary=document.createElement('p');screenSummary.className='pc-screen-info';screenInfo.append(screenSummary);
  function updateScreenInfo(){
   const preview=new URLSearchParams(location.search).get('preview_device');
   const detected=preview?`プレビュー指定: ${preview}`:(desktop?'PC':'スマホ・タブレット');
   screenSummary.textContent=`表示領域 ${innerWidth} × ${innerHeight} CSS px ／ 倍率 ${devicePixelRatio} ／ 判定 ${detected}`;
  }
  updateScreenInfo();window.addEventListener('resize',updateScreenInfo);
  const previewSection=group('端末プレビュー');previewSection.id='pcDevicePreviewSettings';
  const previewNote=document.createElement('p');previewNote.className='pc-preview-warning';previewNote.textContent='枠内での投稿も実際のECHOとして保存されます。同じブラウザの名前・投稿者IDを共有します。タッチ操作・画面キーボード・Silk固有の挙動は再現できません。';
  const previewSelect=document.createElement('select');previewSelect.className='input';previewSelect.setAttribute('aria-label','プレビューする端末');
  const previewPresets=[
   ['スマホ縦','phone',390,844],['スマホ横','phone',844,390],['8インチタブレット縦','tablet',800,1280],['8インチタブレット横','tablet',1280,800],['iPad縦','ipad',820,1180],['iPad横','ipad',1180,820],['テレビ 1920×1080','tv',1920,1080],['テレビ Fire TV / Silk相当（推定）','silk',960,450]
  ];
  previewPresets.forEach((preset,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=`${preset[0]} (${preset[2]}×${preset[3]})`;previewSelect.append(option)});
  const previewOpen=document.createElement('button');previewOpen.type='button';previewOpen.className='btn';previewOpen.textContent='端末プレビューを開く';
  previewSection.append(previewNote,previewSelect,previewOpen);
  const previewOverlay=document.createElement('div');previewOverlay.id='pcDevicePreview';previewOverlay.hidden=true;previewOverlay.setAttribute('role','dialog');previewOverlay.setAttribute('aria-modal','true');previewOverlay.setAttribute('aria-label','端末プレビュー');
  const previewTop=document.createElement('div');previewTop.className='pc-preview-top';
  const previewTitle=document.createElement('strong');previewTitle.textContent='端末プレビュー';
  const previewClose=document.createElement('button');previewClose.type='button';previewClose.className='btn';previewClose.textContent='閉じる';previewTop.append(previewTitle,previewClose);
  const previewStage=document.createElement('div');previewStage.className='pc-preview-stage';
  const previewFrame=document.createElement('iframe');previewFrame.title='選択した端末サイズの画面';previewFrame.allow='autoplay; microphone';previewFrame.referrerPolicy='strict-origin-when-cross-origin';
  const previewScale=document.createElement('div');previewScale.className='pc-preview-scale';previewScale.append(previewFrame);previewStage.append(previewScale);previewOverlay.append(previewTop,previewStage);body.append(previewOverlay);
  function closePreview(){previewOverlay.hidden=true;previewFrame.src='about:blank';previewOpen.focus()}
  previewClose.onclick=closePreview;previewOverlay.addEventListener('click',event=>{if(event.target===previewOverlay)closePreview()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!previewOverlay.hidden)closePreview()});
  function resizePreview(){if(previewOverlay.hidden)return;const preset=previewPresets[Number(previewSelect.value)],scale=Math.min((innerWidth-48)/preset[2],(innerHeight-110)/preset[3],1);previewScale.style.width=preset[2]+'px';previewScale.style.height=preset[3]+'px';previewScale.style.transform=`scale(${Math.max(.1,scale)})`;previewStage.style.width=Math.max(1,preset[2]*scale)+'px';previewStage.style.height=Math.max(1,preset[3]*scale)+'px'}
  previewOpen.onclick=()=>{
   const preset=previewPresets[Number(previewSelect.value)],url=new URL(location.href);url.searchParams.delete('mode');url.searchParams.set('preview_device',preset[1]);if(preset[1]==='tv')url.searchParams.set('mode','tv');
   previewTitle.textContent=`${preset[0]} · ${preset[2]}×${preset[3]} CSS px`;
   previewFrame.style.width=preset[2]+'px';previewFrame.style.height=preset[3]+'px';previewFrame.src=url.href;previewOverlay.hidden=false;resizePreview();previewClose.focus();
  };
  window.addEventListener('resize',resizePreview);
  settings.append(visibility,opacity,previewSection,screenInfo,document.getElementById('labReset'),notice);
  // The legacy route is retained for explicit development URLs, outside normal UI.
  controls.replaceChildren(modes,settings,document.getElementById('labToReview'));
  const cleanToggle=clearButton.onclick;
  function syncMode(){const clean=body.classList.contains('lab-clean');pc.setAttribute('aria-pressed',String(!clean));clearButton.setAttribute('aria-pressed',String(clean));clearButton.textContent='動画だけ'}
  function collapse(){controls.classList.add('is-collapsed');menu.setAttribute('aria-expanded','false')}
  pc.onclick=()=>{if(body.classList.contains('lab-clean'))cleanToggle();syncMode();collapse()};
  clearButton.onclick=()=>{if(!body.classList.contains('lab-clean'))cleanToggle();syncMode();collapse()};
  const key='pulse_echo_pc_menu_v1';let position={left:8,top:8},drag=null,suppressClick=false;
  try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.version===1&&Number.isFinite(saved.left)&&Number.isFinite(saved.top))position={left:saved.left,top:saved.top}}catch{notice.textContent='メニュー位置を読み込めないため初期位置を使います。'}
  function save(){try{localStorage.setItem(key,JSON.stringify({version:1,...position}))}catch{notice.textContent='メニュー位置を保存できません。このページ内では移動できます。'}}
  function fit(){
   if(!active())return;
   const r=menu.getBoundingClientRect(),margin=8;
   position.left=Math.max(margin,Math.min(position.left,innerWidth-r.width-margin));position.top=Math.max(margin,Math.min(position.top,innerHeight-r.height-margin));
   wrapper.style.left=position.left+'px';wrapper.style.top=position.top+'px';
   const width=Math.max(1,Math.min(340,innerWidth-16)),below=innerHeight-position.top-r.height-14,above=position.top-14;
   const upward=below<240&&above>below;
   controls.style.width=width+'px';controls.style.left=Math.min(0,innerWidth-8-position.left-width)+'px';
   controls.style.top=upward?'auto':r.height+6+'px';controls.style.bottom=upward?r.height+6+'px':'auto';
   controls.style.maxHeight=Math.max(1,upward?above:below)+'px';
  }
  menu.onclick=()=>{const collapsed=controls.classList.toggle('is-collapsed');menu.setAttribute('aria-expanded',String(!collapsed));fit()};
  menu.addEventListener('click',event=>{if(suppressClick){suppressClick=false;event.preventDefault();event.stopImmediatePropagation()}},true);
  menu.addEventListener('pointerdown',event=>{
   if(event.button!==0||!active())return;suppressClick=false;drag={id:event.pointerId,x:event.clientX,y:event.clientY,...position,moved:false};menu.setPointerCapture(event.pointerId);
  });
  menu.addEventListener('pointermove',event=>{
   if(!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
   if(Math.hypot(dx,dy)>=6)drag.moved=true;if(!drag.moved)return;
   event.preventDefault();position={left:drag.left+dx,top:drag.top+dy};fit();
  });
  menu.addEventListener('pointerup',event=>{if(!drag||event.pointerId!==drag.id)return;suppressClick=drag.moved;if(drag.moved)save();drag=null});
  for(const name of ['pointercancel','lostpointercapture'])menu.addEventListener(name,()=>{if(drag?.moved){suppressClick=true;save()}drag=null});
  menu.addEventListener('keydown',event=>{
   suppressClick=false;if(!event.altKey||!event.key.startsWith('Arrow'))return;event.preventDefault();
   position.left+=event.key==='ArrowRight'?10:event.key==='ArrowLeft'?-10:0;position.top+=event.key==='ArrowDown'?10:event.key==='ArrowUp'?-10:0;fit();save();
  });
  document.getElementById('labReset').addEventListener('click',()=>{if(body.classList.contains('lab-clean'))cleanToggle();position={left:8,top:8};fit();save();syncMode()});
  window.addEventListener('resize',fit);
  document.addEventListener('pulse-view-mode',()=>{syncMode();fit()});
  syncMode();fit();
 }

 if(requestedMode==='lab'||(desktop&&!requestedMode)){
  activate();
  // Normal desktop URLs remain normal URLs; the saved layout is independent.
  if(!requestedMode)history.replaceState(null,'',entryUrl);
 }
 // mode=review is an explicit development-only entry, not a normal menu item.
})();
