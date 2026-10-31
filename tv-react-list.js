/* Experimental TV REACT: reads current in-memory events; no fetching or persistence. */
(() => {
 const shell=document.getElementById('videoShell'),dock=document.getElementById('tvMapDock'),placeholder=document.querySelector('.tv-react-planned');
 if(!shell||!dock||!placeholder||!window.PULSE_TV_AXIS)return;
 const toggle=document.createElement('button');toggle.type='button';toggle.id='tvReactToggle';toggle.className='tv-react-planned tv-react-toggle';toggle.textContent='▲ REACT';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','tvReactList');placeholder.replaceWith(toggle);
 const panel=document.createElement('section');panel.id='tvReactList';panel.hidden=true;panel.setAttribute('aria-labelledby','tvReactTitle');
 const header=document.createElement('header'),title=document.createElement('h2'),until=document.createElement('span');title.id='tvReactTitle';title.textContent='REACT';const icon=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use');icon.classList.add('tv-react-heading-icon');icon.setAttribute('viewBox','0 0 48 48');icon.setAttribute('aria-hidden','true');icon.setAttribute('focusable','false');use.setAttribute('href','feature-icons.svg#react');icon.append(use);title.append(icon);until.id='tvReactUntil';header.append(title,until);
 const list=document.createElement('ol');list.id='tvReactItems';list.setAttribute('aria-label','現在の再生位置までの反応');
 const empty=document.createElement('p');empty.id='tvReactEmpty';panel.append(header,empty,list);shell.append(panel);
 let opened=false,lastSignature='',limit=8;
 const active=()=>document.body.classList.contains('tv-mode')&&!document.body.classList.contains('lab-mode');
 function snapshot(){
  const duration=PULSE_TV_AXIS.duration(),youtubeId=document.querySelector('.tab.active')?.dataset.video;
  const ready=active()&&duration>0&&typeof player!=='undefined'&&playerReady&&player?.getVideoData?.().video_id===youtubeId;
  const raw=ready?Number(player.getCurrentTime?.()):NaN;
  const now=ready&&Number.isFinite(raw)?Math.max(0,Math.min(duration,player.getPlayerState?.()===0?duration:raw)):null;
  const videoKey=typeof match!=='undefined'&&match?`${match.id}:${currentPart}`:'';
  return{ready:now!==null,duration,now,videoKey,youtubeId};
 }
 function eligible(context){
  if(!context.ready||typeof events==='undefined')return[];
  return events.map((row,index)=>{const raw=row.good_time,sec=typeof raw==='number'||typeof raw==='string'&&raw.trim()!==''?Number(raw):NaN;return{row,sec,key:String(row.id??index)+':'+sec,index}})
   .filter(item=>Number.isFinite(item.sec)&&item.sec>=0&&item.sec<=context.now&&item.sec<=context.duration&&item.row.video_id===context.videoKey)
   .sort((a,b)=>a.sec-b.sec||a.index-b.index).slice(-limit);
 }
 function close(returnFocus=false){opened=false;lastSignature='';panel.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.textContent='▲ REACT';list.replaceChildren();if(returnFocus&&active())toggle.focus({preventScroll:true})}
 function update(){
  if(!active()){if(opened)close();return}if(!opened)return;
  const host=shell.getBoundingClientRect(),bottom=dock.getBoundingClientRect().top-host.top-8,top=48,height=Math.min(432,Math.max(0,bottom-top));
  panel.style.height=height+'px';panel.hidden=height<100;limit=Math.max(1,Math.min(8,Math.floor((height-52+4)/48)));
  const context=snapshot(),rows=eligible(context);until.textContent=context.ready?`${fmt(Math.floor(context.now))}まで`:'読込中';
  const signature=JSON.stringify([context.videoKey,context.youtubeId,context.ready,limit,rows.map(({row,sec,key})=>[key,sec,row.description,row.comment,row.user_name])]);
  if(signature===lastSignature)return;lastSignature=signature;
  const focused=list.contains(document.activeElement)?document.activeElement.closest('button')?.dataset.key:null;
  list.replaceChildren();empty.hidden=rows.length>0;empty.textContent=context.ready?'この時刻までの反応はありません':'動画の読み込みを待っています';
  for(const item of rows){
   const li=document.createElement('li'),button=document.createElement('button'),meta=document.createElement('span'),time=document.createElement('time'),user=document.createElement('span'),text=document.createElement('span');
   button.type='button';button.dataset.key=item.key;button.dataset.time=item.sec;meta.className='tv-react-row-meta';time.textContent=fmt(Math.floor(item.sec));user.className='tv-react-row-user';user.textContent=String(item.row.user_name||'匿名');meta.append(time,user);
   const kind=displayEchoKind(String(item.row.description||'')),comment=String(item.row.comment||'');text.className='tv-react-row-text';text.textContent=comment?`${kind} ${comment}`:kind;button.append(meta,text);
   button.onclick=()=>{if(!opened||!active())return;const current=eligible(snapshot()).find(row=>row.key===item.key);if(!current){update();return}if(PULSE_TV_AXIS.seek(current.sec,true))update()};
   li.append(button);list.append(li);
  }
  if(focused){const button=[...list.querySelectorAll('button')].find(node=>node.dataset.key===focused)||list.querySelector('button');if(button)button.focus({preventScroll:true});else toggle.focus({preventScroll:true})}
  else list.scrollTop=list.scrollHeight;
 }
 toggle.onclick=()=>{if(!active())return;if(opened)close();else{opened=true;lastSignature='';toggle.setAttribute('aria-expanded','true');toggle.textContent='▼ REACT';update()}};
 list.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown'].includes(event.key))return;const buttons=[...list.querySelectorAll('button')],index=buttons.indexOf(event.target);if(index<0)return;event.preventDefault();buttons[Math.max(0,Math.min(buttons.length-1,index+(event.key==='ArrowDown'?1:-1)))].focus()});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened&&active()){event.preventDefault();close(true)}});
 document.addEventListener('pulse-view-mode',()=>{if(!active())close();else update()});window.addEventListener('resize',update);setInterval(update,250);
})();
