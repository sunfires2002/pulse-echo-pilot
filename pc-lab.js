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
 const panelInfo={PULSE:['pulse','みんなの熱量'],ECHO:['echo','反応する'],'ECHO+':['echo-plus','声・ひとこと'],REACT:['react','みんなの反応']};
 function labelGrip(grip,title){
  const [symbol,description]=panelInfo[title];
  grip.innerHTML=`<span class="pc-grip-line"><span class="pc-grip-mark" aria-hidden="true">⠿</span><span class="pc-grip-title"><svg class="feature-icon pc-panel-icon" aria-hidden="true"><use href="feature-icons.svg?v=1.0.0#${symbol}"></use></svg><span>${title}</span></span></span><small>${description}</small>`;
  grip.setAttribute('aria-label',title+'：'+description+'。ドラッグまたは矢印キーで移動');grip.title='ドラッグで移動';
 }
 const handle=document.createElement("div");handle.id="labMapHandle";handle.className="lab-only";handle.tabIndex=0;labelGrip(handle,"PULSE");const playback=document.createElement('span');playback.className='lab-pulse-playback lab-only';playback.innerHTML='<button class="lab-pulse-play-button" id="labPulsePlay" type="button" aria-label="再生" title="再生">▶</button><span class="lab-pulse-clock" id="labPulseClock" aria-live="off">0:00 / --:--</span>';handle.querySelector('.pc-grip-line').append(playback);dock.prepend(handle);
 const resize=document.createElement("button");resize.id="labMapResize";resize.type="button";resize.className="lab-only";resize.setAttribute("aria-label","PULSEのサイズ変更");resize.textContent="↘";dock.append(resize);
 const labPlayhead=document.createElement("div");labPlayhead.className="lab-playhead";labPlayhead.hidden=true;const labPlayheadKnob=document.createElement("button");labPlayheadKnob.type="button";labPlayheadKnob.className="lab-playhead-knob";labPlayheadKnob.setAttribute("aria-label","動画の再生位置をドラッグ");labPlayheadKnob.title="再生位置をドラッグ";labPlayhead.append(labPlayheadKnob);dock.append(labPlayhead);
 const labHoverLine=document.createElement("div");labHoverLine.className="lab-hover-line";labHoverLine.hidden=true;labHoverLine.setAttribute("aria-hidden","true");dock.append(labHoverLine);
 const tip=document.createElement("div");tip.id="labTooltip";tip.hidden=true;tip.setAttribute("role","tooltip");body.append(tip);
 let resizingFrame=0;
 const active=()=>body.classList.contains("lab-mode");
 const labPlayButton=document.getElementById("labPulsePlay"),labClock=document.getElementById("labPulseClock"),labCanvas=document.getElementById("chart");
 let pendingLabSeekPosition=null,pendingLabSeekSeconds=null,labDrag=null,labPreviewSeconds=null,labHoverSeconds=null,pendingLabPlay=false,ignoreLabClickUntil=0;
 function labDuration(){try{return Math.max(0,Number(player?.getDuration?.())||0)}catch{return 0}}
 function labPlayerState(){try{return Number(player?.getPlayerState?.())}catch{return NaN}}
 function labCanvasPoint(event){
  if(!chart?.chartArea||!labCanvas)return null;
  const rect=labCanvas.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0||chart.width<=0||chart.height<=0)return null;
  return{x:(event.clientX-rect.left)*chart.width/rect.width,y:(event.clientY-rect.top)*chart.height/rect.height};
 }
 function labChartPointToDock(x,y){
  const rect=labCanvas.getBoundingClientRect(),dockRect=dock.getBoundingClientRect(),style=getComputedStyle(dock);
  const sx=rect.width/chart.width,sy=rect.height/chart.height,borderLeft=parseFloat(style.borderLeftWidth)||0,borderTop=parseFloat(style.borderTopWidth)||0;
  return{left:rect.left-dockRect.left-borderLeft+x*sx,top:rect.top-dockRect.top-borderTop+y*sy};
 }
 function labClampSeconds(seconds){
  const scale=chart?.scales?.x;if(!scale)return Math.max(0,Number(seconds)||0);
  const min=Number.isFinite(scale.min)?scale.min:0,max=Number.isFinite(scale.max)?scale.max:labDuration();
  return Math.max(min,Math.min(max,Number(seconds)||0));
 }
 function labSecondsToChartX(seconds){
  const scale=chart?.scales?.x;if(!scale||typeof scale.getPixelForValue!=="function")return null;
  return scale.getPixelForValue(labClampSeconds(seconds));
 }
 function labChartXToSeconds(x){
  const scale=chart?.scales?.x;if(!scale||typeof scale.getValueForPixel!=="function")return null;
  const seconds=scale.getValueForPixel(x);return Number.isFinite(seconds)?labClampSeconds(seconds):null;
 }
 function labPointAtEvent(event,requirePlot=true){
  const point=labCanvasPoint(event),area=chart?.chartArea;if(!point||!area||area.right<=area.left)return null;
  if(requirePlot&&(point.x<area.left-1||point.x>area.right+1||point.y<area.top-1||point.y>area.bottom+1))return null;
  return{...point,seconds:labChartXToSeconds(point.x),position:Math.max(0,Math.min(1,(point.x-area.left)/(area.right-area.left)))};
 }
 function labSeekSeconds(seconds){
  const duration=labDuration();if(!Number.isFinite(seconds))return false;
  if(duration<=0){pendingLabSeekSeconds=null;return false}
  seconds=Math.max(0,Math.min(duration,seconds));
  if(!playerReady||!player?.seekTo){pendingLabSeekSeconds=seconds;return false}
  const target=Math.max(0,Math.min(Math.floor(seconds),Math.max(0,Math.ceil(duration)-1)));
  try{player.seekTo(target,true);pendingLabSeekSeconds=null;return true}catch{pendingLabSeekSeconds=seconds;return false}
 }
 function labPlaybackClick(){
  if(!active())return;
  const state=labPlayerState(),duration=labDuration();
  if(!playerReady||!player?.playVideo){pendingLabPlay=!pendingLabPlay;return}
  if(state===1||pendingLabPlay){pendingLabPlay=false;try{player.pauseVideo?.()}catch{};return}
  try{if(state===0||(duration>0&&(Number(player.getCurrentTime?.())||0)>=duration-.5))player.seekTo(0,true);player.playVideo();pendingLabPlay=false}catch{pendingLabPlay=true}
 }
 labPlayButton.onclick=labPlaybackClick;
 function labPulseUpdate(){
  if(!active()){labPlayhead.hidden=true;labHoverLine.hidden=true;return}
  const state=labPlayerState();
  if(pendingLabPlay&&playerReady&&player?.playVideo){try{if(state===0)player.seekTo(0,true);player.playVideo();pendingLabPlay=false}catch{}}
  const liveDuration=labDuration(),current=Number(player?.getCurrentTime?.())||0;
  if(liveDuration>0&&chart?.options?.scales?.x?.type==="linear"&&(Math.abs(Number(chart.options.scales.x.max)-liveDuration)>.1||chart.options.scales.x.offset!==false)){chart.options.scales.x.max=liveDuration;chart.options.scales.x.offset=false;chart.update("none")}
  if(pendingLabSeekPosition!==null&&playerReady&&liveDuration>0&&chart?.chartArea){
   const area=chart.chartArea,x=area.left+pendingLabSeekPosition*(area.right-area.left);pendingLabSeekSeconds=labChartXToSeconds(x);pendingLabSeekPosition=null;
  }
  if(pendingLabSeekSeconds!==null&&playerReady)labSeekSeconds(pendingLabSeekSeconds);
  const preview=labPreviewSeconds!==null?labPreviewSeconds:pendingLabSeekSeconds;
  const shown=preview!==null&&liveDuration>0?preview:(state===0&&liveDuration>0?liveDuration:current);
  labClock.textContent=`${fmt(Math.floor(Math.max(0,shown)))} / ${liveDuration>0?fmt(Math.floor(liveDuration)):"--:--"}`;
  const playing=labPlayerState()===1&&!pendingLabPlay;labPlayButton.textContent=playing?"Ⅱ":"▶";labPlayButton.setAttribute("aria-label",playing?"一時停止":"再生");labPlayButton.title=playing?"一時停止":"再生";
  const area=chart?.chartArea,rect=labCanvas?.getBoundingClientRect(),chartX=labSecondsToChartX(shown);
  if(!area||!rect||liveDuration<=0||rect.width<=0||chart.width<=0||chartX===null){labPlayhead.hidden=true;return}
  const dockPoint=labChartPointToDock(chartX,area.top),sy=rect.height/chart.height;
  labPlayhead.style.left=`${dockPoint.left}px`;
  labPlayhead.style.top=`${dockPoint.top}px`;
  labPlayhead.style.height=`${Math.max(0,(area.bottom-area.top)*sy)}px`;labPlayhead.hidden=false;
 }
 labCanvas.addEventListener("click",event=>{
  if(!active())return;
  event.preventDefault();event.stopImmediatePropagation();
  if(performance.now()<ignoreLabClickUntil){ignoreLabClickUntil=0;event.preventDefault();event.stopImmediatePropagation();return}
  const point=labPointAtEvent(event,true);if(!point)return;
  if(labDuration()<=0){pendingLabSeekPosition=point.position;pendingLabSeekSeconds=null;return}
  labSeekSeconds(point.seconds);labPulseUpdate();
 },true);
 labPlayheadKnob.addEventListener("pointerdown",event=>{
  if(!active()||event.button!==0||labPlayhead.hidden||labDuration()<=0)return;
  const point=labPointAtEvent(event,false);if(!point||point.seconds===null)return;
  labDrag={id:event.pointerId};labPreviewSeconds=point.seconds;dock.classList.add("lab-scrubbing");labPlayheadKnob.setPointerCapture(event.pointerId);event.preventDefault();event.stopPropagation();tip.hidden=true;labHoverLine.hidden=true;labPulseUpdate();
 });
 labPlayheadKnob.addEventListener("pointermove",event=>{
  if(!active()||!labDrag||event.pointerId!==labDrag.id)return;const point=labPointAtEvent(event,false);if(point&&point.seconds!==null)labPreviewSeconds=point.seconds;
  event.preventDefault();event.stopPropagation();tip.hidden=true;labHoverLine.hidden=true;labPulseUpdate();
 });
 function finishLabDrag(event,commit){
  if(!labDrag||event.pointerId!==labDrag.id)return;
  const seconds=labPreviewSeconds;labDrag=null;labPreviewSeconds=null;dock.classList.remove("lab-scrubbing");
  if(commit&&seconds!==null){labSeekSeconds(seconds);ignoreLabClickUntil=performance.now()+400}
  labPulseUpdate();
 }
 labPlayheadKnob.addEventListener("pointerup",event=>{if(!active()||!labDrag||event.pointerId!==labDrag.id)return;event.preventDefault();event.stopPropagation();finishLabDrag(event,true)},true);
 labPlayheadKnob.addEventListener("pointercancel",event=>finishLabDrag(event,false),true);
 setInterval(labPulseUpdate,100);
 labCanvas.addEventListener("mousemove",event=>{
  if(!active()||labDrag)return;
  const point=labPointAtEvent(event,true);labHoverSeconds=point?.seconds??null;
  const area=chart?.chartArea,rect=labCanvas.getBoundingClientRect(),chartX=labHoverSeconds===null?null:labSecondsToChartX(labHoverSeconds);
  if(chartX===null||!area||rect.width<=0||chart?.width<=0){labHoverLine.hidden=true;tip.hidden=true;return}
  const dockPoint=labChartPointToDock(chartX,area.top),sy=rect.height/chart.height;
  labHoverLine.style.left=`${dockPoint.left}px`;labHoverLine.style.top=`${dockPoint.top}px`;labHoverLine.style.height=`${Math.max(0,(area.bottom-area.top)*sy)}px`;labHoverLine.hidden=false;
  if(chart.tooltip?.opacity>0)tooltip({chart,tooltip:chart.tooltip});
 },true);
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

 function makePanel(id,title,selector,initial,fixed=false){
  const source=document.querySelector(selector),anchor=document.createComment(id+" original position");source.before(anchor);
  const panel=document.createElement("section");panel.id=id;panel.className="lab-only lab-panel";panel.hidden=true;
  const grip=document.createElement("div");grip.className="lab-panel-grip";grip.tabIndex=0;labelGrip(grip,title);
  const content=document.createElement("div");content.className="lab-panel-content";
  const corner=document.createElement("button");corner.className="lab-panel-resize";corner.type="button";corner.textContent="↘";corner.setAttribute("aria-label",title+"のサイズ変更");
  panel.append(grip,content);if(!fixed)panel.append(corner);body.append(panel);
  const toggle=document.createElement("button");toggle.className="btn";toggle.type="button";toggle.textContent=title;toggle.setAttribute("aria-pressed","true");controls.insertBefore(toggle,document.getElementById("labReset"));
  function fit(left,top,width,height){
   const floor=8;
   if(fixed){width=effectiveDock()?Math.min(720,parseFloat(dock.style.width)||720):Math.min(720,Math.max(1,innerWidth-16));height=barHeight(width)}
   width=Math.min(Math.max(fixed?1:280,width),Math.max(1,innerWidth-16));height=Math.min(Math.max(fixed?1:140,height),Math.max(1,innerHeight-floor-8));
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
 makePanel("labPosting","ECHO+",".controls",()=>innerHeight<800?[16,Math.max(56,Math.round(innerHeight*.1)),360,290]:[16,130,360,350]);
 makePanel("labTimeline","REACT",".timeline-card",()=>[innerWidth-316,56,300,240]);
 document.getElementById("labReset").textContent="標準配置に戻す";
 document.getElementById("labReset").addEventListener("click",()=>{docked=false;clearDockCandidate();entries.forEach(entry=>{layout[entry.id]=entry.initial();entry.range.value=layout[entry.id].transparency;entry.output.textContent=entry.range.value+'％';applyEntry(entry)});saveLayout()});
 window.addEventListener("resize",()=>panels.forEach(p=>p.update()));
 document.addEventListener("pulse-view-mode",()=>panels.forEach(p=>p.mode()));
 function redraw(){if(resizingFrame)return;resizingFrame=requestAnimationFrame(()=>{resizingFrame=0;if(typeof chart!=="undefined"&&chart)chart.resize()})}
 function bounds(left,top,width,height){
  const floor=8;
  width=Math.min(Math.max(420,width),Math.max(1,innerWidth-16));height=Math.min(Math.max(innerWidth<1440||innerHeight<800?120:160,height),Math.max(1,innerHeight-floor-8-(effectiveDock()?barHeight(Math.min(720,width)):0)));
  left=Math.max(8,Math.min(left,innerWidth-width-8));top=Math.max(floor,Math.min(top,innerHeight-height-8-(effectiveDock()?barHeight(Math.min(720,width)):0)));
  Object.assign(dock.style,{left:left+"px",top:top+"px",width:width+"px",height:height+"px"});tip.hidden=true;redraw();remember("map",dock);if(dockingReady&&!syncingDock)syncDock();
 }
 function mapInitial(){const compact=innerWidth<1440||innerHeight<800,width=Math.min(1200,Math.max(420,innerWidth-376)),height=compact?Math.min(140,Math.max(120,Math.round(innerHeight*.18))):Math.min(180,innerHeight-32),left=Math.max(360,(innerWidth-width)/2);return[left,innerHeight-height-16,width,height]}
 const mapEntry=register("map",dock,"PULSE",bounds,mapInitial,document.getElementById("labMapToggle"),78);
 function updateToggle(){const b=document.getElementById("labMapToggle");b.setAttribute("aria-pressed",String(!dock.hidden))}
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
   if(!active()||event.button!==0||(element===handle&&event.target.closest("button")))return;
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
  const duration=labDuration(),hoverChartX=labHoverSeconds!==null?labSecondsToChartX(labHoverSeconds):model.caretX;
  const pointerSeconds=hoverChartX!==null?labChartXToSeconds(hoverChartX):null;
  const hoverSecond=pointerSeconds!==null&&duration>0?Math.min(Math.floor(pointerSeconds),Math.max(0,Math.ceil(duration)-1)):null;
  const pointIndex=Number(model.dataPoints?.[0]?.dataIndex),bucket=hoverSecond!==null?Math.min(29,Math.floor(hoverSecond/60)):(Number.isInteger(pointIndex)?pointIndex:null);
  const title=document.createElement("strong");title.textContent=hoverSecond!==null?fmt(hoverSecond):"--:--";tip.append(title);
  const range=document.createElement("small");range.className="lab-tooltip-range";
  range.textContent=Number.isInteger(bucket)&&bucket>=0?`${fmt(bucket*60)}〜${fmt(bucket*60+59)} の反応`:"";tip.append(range);
  if(hoverSecond!==null){
   (context.chart.data.datasets||[]).forEach(dataset=>{const value=dataset.data?.[bucket];const count=typeof value==="object"?value?.y:value;if(count===undefined)return;const row=document.createElement("div");row.textContent=dataset.label+"："+count;row.style.borderLeft="4px solid "+dataset.borderColor;row.style.paddingLeft="8px";tip.append(row)});
  }else (model.dataPoints||[]).forEach(point=>{const row=document.createElement("div");row.textContent=point.dataset.label+"："+point.formattedValue;row.style.borderLeft="4px solid "+point.dataset.borderColor;row.style.paddingLeft="8px";tip.append(row)});
  tip.hidden=false;
  const r=context.chart.canvas.getBoundingClientRect(),t=tip.getBoundingClientRect(),area=context.chart.chartArea,scaleY=r.height/context.chart.height;
  const hoverX=hoverChartX!==null?r.left+hoverChartX*r.width/context.chart.width:r.left+model.caretX*r.width/context.chart.width;
  const left=Math.max(8,Math.min(hoverX+12,innerWidth-t.width-8));
  const graphTop=r.top+area.top*scaleY,top=graphTop-t.height-8;
  tip.style.left=left+"px";tip.style.top=top+"px";
 }
 // Configure before Chart constructs its plugin option descriptors.
 window.PULSE_PC_CHART_OPTIONS=options=>{
  const lab=active();options.maintainAspectRatio=!lab;
  options.plugins.tooltip={enabled:!lab,external:lab?tooltip:null,mode:lab?"index":"nearest",intersect:!lab};
 };
 document.getElementById("chart").addEventListener("mouseleave",()=>{tip.hidden=true;labHoverSeconds=null;labHoverLine.hidden=true});
 document.addEventListener("pulse-view-mode",()=>{
  if(typeof chart==="undefined"||!chart||typeof draw!=="function"||!Array.isArray(events))return;
  if((chart.options.scales?.x?.type==="linear")!==active())draw(events);
 });

 // LAB reaction bar: relocate the original controls; never clone posting handlers.
 const reactionSource=document.createElement('div');reactionSource.className='lab-reaction-source';reactionSource.hidden=true;body.append(reactionSource);
 const reactions=[document.getElementById('tvNameOpen'),...document.querySelectorAll('.controls .react[data-kind]')];
 const origins=reactions.map(node=>{const anchor=document.createComment('LAB reaction original');node.before(anchor);return{node,anchor}});
 const barEntry=makePanel('labReactions','ECHO','.lab-reaction-source',()=>{const m=mapInitial(),width=Math.min(720,m[2]);return[m[0]+(m[2]-width)/2,Math.max(8,m[1]-barHeight(width)-12),width,88]},true);
 barEntry.panel.classList.add('lab-reaction-bar');
 const splitButton=document.createElement('button');splitButton.id='labUndock';splitButton.type='button';splitButton.className='btn';splitButton.textContent='分離';splitButton.hidden=true;barEntry.panel.querySelector('.lab-panel-grip').after(splitButton);
 splitButton.onclick=()=>splitDock(true);
 function barHeight(width){const columns=Math.max(1,Math.floor((width-16+6)/118));return 74+Math.ceil(6/columns)*40+(Math.ceil(6/columns)-1)*6}
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
  const nameButton=document.getElementById('tvNameOpen');
  const updateNameLabel=()=>{const name=window.PULSE_PROFILE?.getName()||'匿名';nameButton.textContent='名前：'+name;nameButton.title='クリックして名前を変更';nameButton.setAttribute('aria-label','名前：'+name+'。クリックして変更')};
  updateNameLabel();document.addEventListener('pulse-profile-name-changed',updateNameLabel);
  const titles={map:'PULSE',labReactions:'ECHO',labPosting:'ECHO+',labTimeline:'REACT'};
  entries.forEach(entry=>{const title=titles[entry.id],description=panelInfo[title][1];entry.toggle.innerHTML=`<span>${title}</span><small>${description}</small>`;visibility.append(entry.toggle);entry.toggle.title=title+'の表示／非表示';entry.toggle.setAttribute('aria-label',title+'：'+description+'の表示／非表示')});
  const opacity=document.createElement('details');opacity.id='pcOpacitySettings';
  const summary=document.createElement('summary');summary.textContent='⚙ 透明度';opacity.append(summary);
  entries.forEach(entry=>opacity.append(entry.range.closest('label')));
  const dockHelp=document.createElement('p');dockHelp.id='pcDockHelp';dockHelp.textContent='合体：ECHOのつまみをPULSEの下端へドラッグし、「離すと合体」が出たら離します。合体後はECHOの「分離」で戻せます。';
  settings.append(visibility,opacity,dockHelp,document.getElementById('labReset'),notice);
  // The legacy route is retained for explicit development URLs, outside normal UI.
  const videoControls=window.PULSE_PC_VIDEO?.createMenu(labPlaybackClick);
  controls.replaceChildren(...(videoControls?[videoControls]:[]),modes,settings,document.getElementById('labToReview'));
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
