/* TV GOAL UI prototype. Only explicit goalLab=1, in-page data, no persistence. */
(() => {
 const qs=new URLSearchParams(location.search);if(qs.get('mode')!=='tv'||qs.get('goalLab')!=='1'||!window.PULSE_PRISM_GOALS)return;
 const shell=document.getElementById('videoShell'),dock=document.getElementById('tvMapDock'),canvas=document.getElementById('chart');if(!shell||!dock||!canvas||!window.PULSE_TV_AXIS)return;
 const store=PULSE_PRISM_GOALS.createStore(),lead=10,width=36,gap=6;
 const layer=document.createElement('div');layer.className='tv-goal-layer';layer.id='tvGoalLayer';layer.setAttribute('role','group');layer.setAttribute('aria-label','GOAL 検証サンプル');dock.append(layer);
 const menu=document.createElement('section');menu.id='tvGoalMenu';menu.className='tv-goal-menu';menu.hidden=true;menu.setAttribute('aria-label','近接GOALを選択');shell.append(menu);
 let signature='',openNos=null,opener=null;
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
 function close(restore=false){menu.hidden=true;openNos=null;menu.replaceChildren();if(restore&&opener?.isConnected)opener.focus({preventScroll:true});opener=null}
 function jump(no){const c=context(),goal=eligible(c).find(g=>g.no===no);if(!goal){render();return}if(PULSE_TV_AXIS.seek(Math.max(0,goal.sec-lead),true)){close();render()}}
 function showMenu(group,button,focus=false){
  const c=context(),valid=eligible(c).filter(g=>group.goals.some(old=>old.no===g.no));if(!valid.length){close();return}
  const focused=menu.contains(document.activeElement)?document.activeElement.dataset.no:null;openNos=valid.map(g=>g.no);opener=button;menu.replaceChildren();const header=document.createElement('header'),text=document.createElement('span'),dismiss=document.createElement('button');text.textContent=`近接GOAL ${valid.length}件 · ${lead}秒前から再生`;dismiss.textContent='閉じる';dismiss.type='button';dismiss.onclick=()=>close(true);header.append(text,dismiss);menu.append(header);
  for(const goal of valid){const choice=document.createElement('button');choice.type='button';choice.className='choice';choice.dataset.no=goal.no;choice.textContent=label(goal,c);choice.onclick=()=>jump(goal.no);menu.append(choice)}
  const s=shell.getBoundingClientRect(),d=dock.getBoundingClientRect(),b=button.getBoundingClientRect(),w=Math.min(360,s.width-32);Object.assign(menu.style,{left:Math.max(16,Math.min(s.width-w-16,b.left-s.left-w/2))+'px',bottom:(s.bottom-d.top+8)+'px',maxHeight:Math.max(40,Math.min(240,d.top-s.top-16))+'px'});menu.hidden=false;if(focus)menu.querySelector('.choice')?.focus({preventScroll:true});else if(focused)[...menu.querySelectorAll('.choice')].find(b=>b.dataset.no===focused)?.focus({preventScroll:true});
 }
 function render(){
  const c=context(),r=canvas.getBoundingClientRect(),d=dock.getBoundingClientRect();Object.assign(layer.style,{top:(r.top-d.top-dock.clientTop)+'px',height:r.height+'px'});
  const host=layer.getBoundingClientRect(),chartHeight=Number(chart?.height)||r.height||1,zeroY=(chart?.scales?.y?.getPixelForValue(0)??0)*r.height/chartHeight,hitTop=Math.max(0,Math.min(r.height-32,zeroY-16)),goals=eligible(c),groups=[];
  for(const goal of goals){const pixel=PULSE_TV_AXIS.secondsToX(goal.sec);if(pixel===null)continue;const x=r.left-host.left+pixel*r.width/chart.width,left=Math.max(0,Math.min(host.width-width,x-width/2)),last=groups.at(-1);if(last&&left<last.left+width+gap)last.goals.push(goal);else groups.push({x,left,goals:[goal]})}
  const next=JSON.stringify([c?.key,host.width,r.height,zeroY,hitTop,groups.map(g=>[g.x,g.left,g.goals.map(x=>x.no)])]);if(next===signature)return;signature=next;
  const focused=layer.contains(document.activeElement)?document.activeElement.dataset.nos:null;layer.replaceChildren();
  for(const group of groups){const button=document.createElement('button'),frame=document.createElement('span'),ball=document.createElement('span');button.type='button';button.className='tv-goal-ball';button.dataset.nos=group.goals.map(g=>g.no).join(',');button.dataset.sec=group.goals[0].sec;button.style.left=group.left+'px';button.style.top=hitTop+'px';button.setAttribute('aria-label',group.goals.length>1?`近接GOAL ${group.goals.length}件を選択`:label(group.goals[0],c)+` · ${lead}秒前から再生`);ball.className='ball';ball.textContent='⚽';ball.style.left=(group.x-group.left)+'px';ball.style.top=(zeroY-hitTop-8)+'px';ball.setAttribute('aria-hidden','true');frame.className='tv-goal-frame';frame.setAttribute('aria-hidden','true');button.style.setProperty('--goal-x',(group.x-group.left)+'px');button.style.setProperty('--goal-y',(zeroY-hitTop)+'px');button.append(frame,ball);
   if(group.goals.length>1){const count=document.createElement('span');count.className='count';count.textContent=group.goals.length;button.append(count);button.setAttribute('aria-haspopup','true')}
   button.onclick=()=>{if(group.goals.length>1)showMenu(group,button,true);else jump(group.goals[0].no)};layer.append(button);
  }
  if(openNos){const group=groups.find(g=>g.goals.some(goal=>openNos.includes(goal.no)));if(!group)close();else{const button=[...layer.children].find(b=>b.dataset.nos===group.goals.map(g=>g.no).join(','));showMenu(group,button)}}
  if(focused){const target=[...layer.children].find(b=>b.dataset.nos===focused);target?.focus({preventScroll:true})}
 }
 menu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true)}});document.addEventListener('pointerdown',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!layer.contains(event.target))close()});
 store.subscribe(()=>{signature='';close();render()});window.PULSE_TV_GOALS=Object.freeze({replace:input=>store.replace(input),clear:()=>store.clear(),leadSeconds:lead});
 for(const id of ['tv-goal-a','tv-goal-b'])fetch(`fixtures/tv-goals/${id}.json`).then(r=>{if(!r.ok)throw Error('GOALサンプルを読み込めません');return r.json()}).then(input=>store.replace(input)).catch(error=>console.warn('[TV GOAL LAB]',error.message));
 document.addEventListener('pulse-view-mode',()=>{close();signature='';render()});window.addEventListener('resize',()=>{signature='';render()});setInterval(render,200);render();
})();
