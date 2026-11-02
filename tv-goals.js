/* TV GOAL UI prototype. Only explicit goalLab=1, in-page data, no persistence. */
(() => {
 const qs=new URLSearchParams(location.search);if(qs.get('mode')!=='tv'||qs.get('goalLab')!=='1'||!window.PULSE_PRISM_GOALS)return;
 const shell=document.getElementById('videoShell'),dock=document.getElementById('tvMapDock'),canvas=document.getElementById('chart');if(!shell||!dock||!canvas||!window.PULSE_TV_AXIS)return;
 const store=PULSE_PRISM_GOALS.createStore(),lead=10,width=36,gap=6,maxGroupSeconds=60;
 const layer=document.createElement('div');layer.className='tv-goal-layer';layer.id='tvGoalLayer';layer.setAttribute('role','group');layer.setAttribute('aria-label','GOAL 検証サンプル');dock.append(layer);
 let signature='',pressed=null;
 function trace(type,data){try{window.PULSE_GOAL_TRACE?.(type,data)}catch{}}
 const fmt=sec=>{const value=Math.floor(sec);return`${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`};
 function context(){
  const active=document.body.classList.contains('tv-mode')&&!document.body.classList.contains('lab-mode'),duration=PULSE_TV_AXIS.duration();
  if(!active||duration<=0||typeof player==='undefined'||!playerReady||!player?.getCurrentTime)return null;
  const youtubeId=player.getVideoData?.().video_id,selected=document.querySelector('.tab.active')?.dataset.video,half=currentPart==='前半'?'1st':currentPart==='後半'?'2nd':null;
  if(!half||youtubeId!==selected)return null;const now=player.getPlayerState?.()===0?duration:Number(player.getCurrentTime());if(!Number.isFinite(now))return null;
  const record=store.select({matchId:match?.id,half,youtubeId});return record?{record,duration,now:Math.max(0,Math.min(duration,now)),key:match.id+':'+half+':'+youtubeId}:null;
 }
 const eligible=c=>c?c.record.goals.filter(goal=>goal.sec<=c.duration&&goal.sec<=c.now):[];
 function label(goal,c){const scorer=goal.scorer?(goal.scorer.og?' OG':` ${goal.scorer.number?'#'+goal.scorer.number:''} ${goal.scorer.name||''}`.trimEnd()):'';return`${fmt(goal.sec)} ${c.record.teams[goal.team].name} ${goal.score.join('–')}${scorer}`}
 function jumpGroup(button){
  trace('goal.click',{nos:button.goalNos});const c=context(),goal=c?.key===button.goalContext?eligible(c).find(g=>button.goalNos.includes(g.no)):null;
  if(!goal){trace('goal.rejected',{reason:c?'no-eligible-goal':'context-not-ready'});render();return}
  const target=Math.max(0,goal.sec-lead);trace('goal.target',{no:goal.no,sec:goal.sec,target,now:c.now});const accepted=PULSE_TV_AXIS.seek(target,true);trace('goal.seek-result',{accepted,target});if(accepted)render();
 }
 function hold(button,event){
  pressed={button,key:button.goalContext,nos:[...button.goalNos],rect:button.getBoundingClientRect()};
  if(event.type==='pointerdown')try{button.setPointerCapture?.(event.pointerId)}catch{}
 }
 function release(){if(!pressed)return;const gesture=pressed;setTimeout(()=>{if(pressed===gesture){pressed=null;signature='';render()}},0)}
 document.addEventListener('pointerup',release);document.addEventListener('pointercancel',release);
 document.addEventListener('keyup',event=>{if(['Enter',' '].includes(event.key))release()});window.addEventListener('blur',release);
 function makeButton(){
  const button=document.createElement('button'),frame=document.createElement('span'),ball=document.createElement('span');
  button.type='button';button.className='tv-goal-ball';frame.className='tv-goal-frame';frame.setAttribute('aria-hidden','true');ball.className='ball';ball.textContent='⚽';ball.setAttribute('aria-hidden','true');button.append(frame,ball);
  button.addEventListener('pointerdown',event=>{if(event.button===0)hold(button,event)});
  button.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&!event.repeat)hold(button,event)});
  button.onclick=event=>{
   if(pressed?.button===button&&event.detail>0){const current=button.getBoundingClientRect(),inside=r=>event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;if(!inside(pressed.rect)&&!inside(current))return}
   jumpGroup(button);
  };
  return button;
 }

 function render(){
  const c=context(),r=canvas.getBoundingClientRect(),d=dock.getBoundingClientRect();Object.assign(layer.style,{top:(r.top-d.top-dock.clientTop)+'px',height:r.height+'px'});
  const host=layer.getBoundingClientRect(),chartHeight=Number(chart?.height)||r.height||1,zeroY=(chart?.scales?.y?.getPixelForValue(0)??0)*r.height/chartHeight,hitTop=Math.max(0,Math.min(r.height-32,zeroY-16)),goals=eligible(c),groups=[];
  for(const goal of goals){const pixel=PULSE_TV_AXIS.secondsToX(goal.sec);if(pixel===null)continue;const x=r.left-host.left+pixel*r.width/chart.width,left=Math.max(0,Math.min(host.width-width,x-width/2)),last=groups.at(-1);if(last&&left<last.left+width+gap&&goal.sec-last.goals[0].sec<=maxGroupSeconds)last.goals.push(goal);else groups.push({x,left,goals:[goal]})}
  const next=JSON.stringify([c?.key,host.width,r.height,zeroY,hitTop,groups.map(g=>[g.x,g.left,g.goals.map(x=>x.no)])]);if(next===signature)return;signature=next;
  const previous=[...layer.children],used=new Set(),ordered=[],held=pressed?.key===c?.key?pressed:null;
  // Claim the pressed element first, even if its group merges or splits.
  const heldGroup=held?groups.find(g=>g.goals.some(goal=>held.nos.includes(goal.no))):null;
  for(const group of groups){
   const key=c.key+':'+group.goals[0].no;
   const button=group===heldGroup?held.button:previous.find(b=>!used.has(b)&&b!==held?.button&&b.goalKey===key)||previous.find(b=>!used.has(b)&&b!==held?.button&&b.goalContext===c.key&&b.goalNos.some(no=>group.goals.some(g=>g.no===no)))||makeButton();
   used.add(button);ordered.push(button);button.goalKey=key;button.goalContext=c.key;button.goalNos=group.goals.map(g=>g.no);button.dataset.nos=button.goalNos.join(',');button.dataset.sec=group.goals[0].sec;
   button.style.left=group.left+'px';button.style.top=hitTop+'px';button.setAttribute('aria-label',group.goals.length>1?`近接GOAL ${group.goals.length}件 · ${label(group.goals[0],c)} · 最初のGOALの${lead}秒前から再生`:label(group.goals[0],c)+` · ${lead}秒前から再生`);
   const ball=button.querySelector('.ball');ball.style.left=(group.x-group.left)+'px';ball.style.top=(zeroY-hitTop-8)+'px';button.style.setProperty('--goal-x',(group.x-group.left)+'px');button.style.setProperty('--goal-y',(zeroY-hitTop)+'px');
   let count=button.querySelector('.count');if(group.goals.length>1){if(!count){count=document.createElement('span');count.className='count';button.append(count)}count.textContent=group.goals.length}else count?.remove();
   // Never detach/reappend a live button: that can break a native click too.
   if(button.parentNode!==layer)layer.append(button);
  }
  for(const button of previous)if(!used.has(button))button.remove();
  let anchor=null;for(const button of ordered.reverse()){if(button!==held?.button&&button.nextSibling!==anchor)layer.insertBefore(button,anchor);anchor=button}

 }
 store.subscribe(()=>{signature='';render()});window.PULSE_TV_GOALS=Object.freeze({replace:input=>store.replace(input),clear:()=>store.clear(),leadSeconds:lead,maxGroupSeconds});
 for(const id of ['tv-goal-a','tv-goal-b'])fetch(`fixtures/tv-goals/${id}.json`).then(r=>{if(!r.ok)throw Error('GOALサンプルを読み込めません');return r.json()}).then(input=>store.replace(input)).catch(error=>console.warn('[TV GOAL LAB]',error.message));
 document.addEventListener('pulse-view-mode',()=>{signature='';render()});window.addEventListener('resize',()=>{signature='';render()});setInterval(render,200);render();
})();
