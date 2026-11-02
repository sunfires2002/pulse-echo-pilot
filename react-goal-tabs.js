/* Opt-in, standard-view GOAL tabs. Original REACT DOM and handlers stay intact. */
(() => {
 const query=new URLSearchParams(location.search);if(query.get('goalTabsLab')!=='1')return;
 const phone=/iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent)||navigator.userAgentData?.mobile===true,landscape=matchMedia('(orientation:landscape)');
 const shortLandscape=matchMedia('(max-height:500px) and (orientation:landscape)');
 const allowed=()=>!document.body.classList.contains('tv-mode')&&!document.body.classList.contains('lab-mode')&&!['tv','lab'].includes(new URLSearchParams(location.search).get('mode'))&&!shortLandscape.matches&&!(phone&&landscape.matches)&&(!window.PULSE_PC_DESKTOP||window.PULSE_PC_READY);
 let loading=null,store=null,ui=null,last='',selected='react';
 function resources(){if(loading)return loading;loading=new Promise((resolve,reject)=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='react-goal-tabs.css?v=0.1.0';document.head.append(css);
  const script=document.createElement('script');script.src='prism-goals-core.js?v=1.0.0';script.onload=resolve;script.onerror=()=>reject(Error('GOALデータ処理を読み込めません'));document.head.append(script);
 }).then(()=>{
  store=PULSE_PRISM_GOALS.createStore();store.subscribe(()=>{last='';update()});
  window.PULSE_STANDARD_GOALS=Object.freeze({replace:input=>store.replace(input),clear:()=>store.clear()});
  for(const id of ['react-goal-a','react-goal-b'])fetch(`fixtures/react-goal-tabs/${id}.json`).then(r=>{if(!r.ok)throw Error('GOALサンプルを読み込めません');return r.json()}).then(record=>store.replace(record)).catch(error=>console.warn('[REACT GOAL LAB]',error.message));
 }).catch(error=>console.warn('[REACT GOAL LAB]',error.message));return loading}
 function context(){try{
  if(!allowed()||!store||typeof match==='undefined'||!match||typeof player==='undefined'||!playerReady||!player?.getDuration||!player?.getCurrentTime)return null;
  const youtubeId=player.getVideoData?.().video_id,expected=document.querySelector('.tab.active')?.dataset.video,half=currentPart==='前半'?'1st':currentPart==='後半'?'2nd':null,duration=Number(player.getDuration()),time=Number(player.getCurrentTime());
  if(!half||!youtubeId||youtubeId!==expected||!Number.isFinite(duration)||duration<=0||!Number.isFinite(time))return null;
  return{record:store.select({matchId:match.id,half,youtubeId}),duration,time:player.getPlayerState?.()===0?duration:Math.max(0,Math.min(duration,time)),key:match.id+':'+half+':'+youtubeId};
 }catch{return null}}
 const eligible=c=>c?.record?c.record.goals.filter(goal=>goal.sec<=c.duration&&goal.sec<=c.time):[];
 const time=sec=>`${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,'0')}`;
 function choose(name){if(!ui)return;selected=name;ui.react.hidden=name!=='react';ui.goals.hidden=name!=='goal';for(const button of ui.tabs){const active=button.dataset.goalTab===name;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1}}
 function mount(){
  const card=document.querySelector('.timeline-card'),filter=card?.querySelector('.filter'),timeline=document.getElementById('timeline');if(!card||!filter||!timeline)return;
  const bar=document.createElement('div');bar.className='react-goal-tabs';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','一覧の切替');
  const react=document.createElement('div'),goals=document.createElement('div'),list=document.createElement('div'),empty=document.createElement('p');react.id='standardReactPanel';goals.id='standardGoalPanel';react.setAttribute('role','tabpanel');goals.setAttribute('role','tabpanel');goals.className='standard-goal-panel';list.className='standard-goal-list';empty.className='muted';empty.setAttribute('role','status');goals.append(empty,list);
  const tabs=['react','goal'].map(name=>{const button=document.createElement('button');button.type='button';button.id='standard-'+name+'-tab';button.dataset.goalTab=name;button.setAttribute('role','tab');button.setAttribute('aria-controls',name==='react'?react.id:goals.id);button.textContent=name==='react'?'REACT':'⚽ GOAL';button.onclick=()=>choose(name);bar.append(button);return button});
  react.setAttribute('aria-labelledby',tabs[0].id);goals.setAttribute('aria-labelledby',tabs[1].id);
  bar.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?1:selected==='react'?1:0;choose(index?'goal':'react');tabs[index].focus()});
  card.insertBefore(bar,filter);react.append(filter,timeline);card.append(react,goals);ui={card,bar,react,goals,filter,timeline,list,empty,tabs};document.body.classList.add('react-goal-tabs-active');last='';choose('react');
 }
 function unmount(){if(!ui)return;ui.card.append(ui.filter,ui.timeline);ui.bar.remove();ui.react.remove();ui.goals.remove();ui=null;last='';selected='react';document.body.classList.remove('react-goal-tabs-active')}
 function update(){
  if(!ui||!allowed())return;const c=context(),goals=eligible(c),signature=JSON.stringify([c?.key,goals]);if(signature===last)return;last=signature;
  const focused=ui.list.contains(document.activeElement)?document.activeElement.dataset.no:null,previous=ui.context===c?.key?[...ui.list.children]:[],used=new Set(),ordered=[];if(ui.context!==c?.key)ui.list.replaceChildren();ui.context=c?.key;ui.empty.hidden=goals.length>0;ui.empty.textContent=c?.record?'この時刻までのGOALはありません。':'GOALデータはありません。';
  for(const goal of goals){const button=previous.find(b=>Number(b.dataset.no)===goal.no)||document.createElement('button');used.add(button);ordered.push(button);button.type='button';button.className='standard-goal-item';button.dataset.no=goal.no;button.dataset.sec=goal.sec;
   const heading=button.querySelector('span')||document.createElement('span'),detail=button.querySelector('small')||document.createElement('small');heading.textContent=`⚽ ${time(goal.sec)}　${c.record.teams[goal.team].name}　${goal.score.join('–')}`;const scorer=goal.scorer;detail.textContent=scorer?.og?'OG':scorer?[scorer.number?'#'+scorer.number:'',scorer.name||''].filter(Boolean).join(' '):'';detail.hidden=!detail.textContent;if(!heading.parentNode)button.append(heading,detail);
   button.onclick=()=>{const now=context(),current=now?.key===c.key?eligible(now).find(item=>item.no===goal.no):null;if(!current){last='';update();return}try{player.seekTo(Math.max(0,current.sec-10),true);echoPlayed.clear();player.playVideo?.();last='';update()}catch{}};if(button.parentNode!==ui.list)ui.list.append(button);
  }
  for(const button of previous)if(!used.has(button))button.remove();
  let anchor=null;for(const button of ordered.reverse()){if(button.nextSibling!==anchor)ui.list.insertBefore(button,anchor);anchor=button}
  if(focused)(ui.list.querySelector(`[data-no="${focused}"]`)||ui.tabs[1]).focus({preventScroll:true});
 }
 async function sync(){if(!allowed()){unmount();return}await resources();if(!allowed()||!store)return;if(!ui)mount();update()}
 function start(){document.addEventListener('pulse-pc-ready',sync);document.addEventListener('pulse-view-mode',sync);window.addEventListener('resize',sync);shortLandscape.addEventListener('change',sync);landscape.addEventListener('change',sync);setInterval(()=>{if(allowed()){if(ui)update();else sync()}else unmount()},250);sync()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
