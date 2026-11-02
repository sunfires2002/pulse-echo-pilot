/* Observation only; opt-in local LAB. No seeking, posting, or storage writes here. */
(() => {
 const q=new URLSearchParams(location.search);
 if(q.get('mode')!=='tv'||q.get('goalDiag')!=='1'||window.PULSE_GOAL_DIAG)return;
 const session=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
 const rows=[],ids=new WeakMap(),wrapped=new WeakSet(),started=performance.now();let serial=0,click=0,instance=null,lastState='',pending=null,panel=null,sent=0;
 const node=e=>{if(!e||e.nodeType!==1)return null;if(!ids.has(e))ids.set(e,++serial);return{id:ids.get(e),tag:e.tagName,dom:e.id||null,nos:e.closest?.('.tv-goal-ball')?.dataset.nos||null,connected:e.isConnected}};
 function state(){try{return{ready:typeof playerReady!=='undefined'&&playerReady,attempt:typeof playerAttempt!=='undefined'?playerAttempt:null,time:typeof player!=='undefined'?player?.getCurrentTime?.()??null:null,state:typeof player!=='undefined'?player?.getPlayerState?.()??null:null,video:typeof player!=='undefined'?player?.getVideoData?.().video_id??null:null,duration:window.PULSE_TV_AXIS?.duration()??null,axisMax:typeof chart!=='undefined'?chart?.scales?.x?.max??null:null,focused:node(document.activeElement),pageFocus:document.hasFocus()}}catch(error){return{snapshotError:String(error)}}}
 function record(type,data={}){const row={session,n:rows.length+1,ms:Math.round(performance.now()-started),type,click,...data};rows.push(row);if(panel){const count=t=>rows.filter(r=>r.type===t).length;panel.textContent=`GOAL診断 入力↓${count('pointerdown')} ↑${count('pointerup')} / 受付${count('goal.click')} / 命令${count('seek.call')} / 反映${count('seek.applied')}\n${type} ${data.target??data.reason??''}`};return row}
 window.PULSE_GOAL_TRACE=(type,data)=>{try{record(type,{...data,snapshot:state()})}catch{}};
 window.PULSE_GOAL_DIAG=Object.freeze({rows,export:()=>JSON.parse(JSON.stringify(rows)),state});
 for(const type of ['pointerdown','pointerup','pointercancel','mousedown','mouseup','click','focusin','focusout','keydown'])document.addEventListener(type,event=>{if(type==='click')click++;record(type,{target:node(event.target),key:event.key===undefined?undefined:(['Enter',' ','Tab','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)?event.key:'[character]'),pointerType:event.pointerType,x:event.clientX,y:event.clientY,trusted:event.isTrusted,button:event.button,snapshot:state()})},true);
 let lastMove=0;document.addEventListener('pointermove',event=>{if(performance.now()-lastMove<250)return;lastMove=performance.now();record('pointermove',{target:node(event.target),x:event.clientX,y:event.clientY,pointerType:event.pointerType})},true);
 window.addEventListener('focus',()=>record('window.focus'));window.addEventListener('blur',()=>record('window.blur'));document.addEventListener('visibilitychange',()=>record('visibility',{hidden:document.hidden}));
 window.addEventListener('resize',()=>record('viewport',{width:innerWidth,height:innerHeight}));
 window.addEventListener('error',event=>record('page.error',{message:event.message}));
 window.addEventListener('unhandledrejection',event=>record('page.rejection',{message:String(event.reason)}));
 function start(){
  panel=document.createElement('pre');panel.id='goalDiagnosticsStatus';panel.setAttribute('aria-hidden','true');Object.assign(panel.style,{position:'fixed',left:'8px',top:'50px',zIndex:'10002',margin:'0',padding:'5px 8px',font:'12px/1.4 monospace',background:'rgba(0,0,0,.8)',color:'#ffe68a',pointerEvents:'none',maxWidth:'80vw',whiteSpace:'pre-wrap'});document.body.append(panel);
  new MutationObserver(changes=>{for(const change of changes){if(change.target.id!=='tvGoalLayer')continue;record('goal.dom',{removed:[...change.removedNodes].map(node).filter(Boolean),added:[...change.addedNodes].map(node).filter(Boolean),snapshot:state()})}}).observe(document.body,{subtree:true,childList:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 setInterval(()=>{
  try{
   const p=typeof player!=='undefined'?player:null;
   if(p!==instance){instance=p;record('player.instance',{snapshot:state()})}
   if(p&&typeof p.seekTo==='function'&&!wrapped.has(p.seekTo)){
    const original=p.seekTo;const observe=function(...args){const row=record('seek.call',{target:args[0],allowSeekAhead:args[1],snapshot:state()});pending={n:row.n,target:args[0],at:performance.now(),p};try{return original.apply(this,args)}catch(error){record('seek.throw',{message:String(error)});throw error}};wrapped.add(observe);p.seekTo=observe;
   }
   const s=state(),signature=JSON.stringify([s.ready,s.attempt,s.state,s.duration,s.video]);if(signature!==lastState){lastState=signature;record('player.state',{snapshot:s})}
   if(pending){const elapsed=performance.now()-pending.at;if(instance!==pending.p){record('seek.recreated',{seek:pending.n,snapshot:s});pending=null}else if(typeof s.time==='number'&&Math.abs(s.time-pending.target)<2){record('seek.applied',{seek:pending.n,target:pending.target,actual:s.time,elapsed:Math.round(elapsed)});pending=null}else if(elapsed>8000){record('seek.timeout',{seek:pending.n,target:pending.target,snapshot:s});pending=null}}
  }catch(error){record('observer.error',{message:String(error)})}
 },50);
 // Available only on this opt-in diagnostic preview server, never Supabase.
 function flush(){if(!['127.0.0.1','localhost','192.168.0.16'].includes(location.hostname)||rows.length===sent)return;const batch=rows.slice(sent,sent+100);if(navigator.sendBeacon('/__goal_diag__',JSON.stringify({path:location.pathname,match:new URLSearchParams(location.search).get('id'),rows:batch})))sent+=batch.length}
 setInterval(flush,1000);window.addEventListener('pagehide',flush);
 record('diagnostic.start',{session,case:q.get('diagCase')?.slice(0,40)||'unspecified',width:innerWidth,height:innerHeight});
})();
