/* Opt-in PC ECHO experiment. New option kinds never enter addEvent/events/Supabase. */
(() => {
 const definitions={
  '🔥 ナイスプレー':[{label:'シュート'},{label:'キーパー'},{label:'パス'},{label:'守備'}],
  '😫 惜しい':[{label:'シュート'},{label:'パス'},{label:'あと一歩'}],
  '😅 あちゃー':[{label:'空振り'},{label:'すれ違い'},{label:'ドンマイ'}],
  '😳 マジで':[{label:'スーパー'},{label:'びっくり'},{label:'まさか'}],
  '🤖 AIにお任せ':[{label:'気になる'},{label:'あとで確認'}]
 };
 function create({panel,reactions,options,active}){
  const tray=document.createElement('section');tray.id='echoOptionsLabTray';tray.hidden=true;tray.setAttribute('aria-label','ECHO追加オプション');
  const choices=document.createElement('div');choices.className='echo-lab-choices';const close=document.createElement('button');close.type='button';close.className='echo-lab-close';close.textContent='×';close.setAttribute('aria-label','追加オプションを閉じる');tray.append(choices,close);
  const original=[...options.querySelectorAll('button')].map(button=>({button,text:button.textContent})),experimental=[];let current=null,visualTop=null,lastInlineTop=null;
  const enabled=()=>active()&&new URLSearchParams(location.search).get('echoOptionsLab')==='1';
  function set(name,value){if(panel.style.getPropertyValue(name)!==value)panel.style.setProperty(name,value)}
  function fit(){
   if(!enabled()||tray.hidden)return;
   panel.classList.toggle('echo-options-narrow',panel.clientWidth<=440);
   const style=getComputedStyle(panel),content=panel.querySelector('.lab-panel-content'),grip=panel.querySelector('.lab-panel-grip'),s=getComputedStyle(content);
   const base=Number.parseFloat(panel.style.height)||panel.offsetHeight,top=Number.parseFloat(panel.style.top)||8;
   const header=panel.clientWidth>440?Math.max(grip.offsetHeight,tray.scrollHeight):grip.offsetHeight+tray.scrollHeight;
   const source=panel.querySelector('.lab-reaction-source'),needed=header+source.scrollHeight+parseFloat(s.paddingTop)+parseFloat(s.paddingBottom)+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+2;
   const docked=panel.classList.contains('lab-bar-docked'),height=docked?base:Math.min(innerHeight-16,Math.max(base,needed));if(docked)visualTop=top;else if(visualTop===null)visualTop=top-(height-base);else if(lastInlineTop!==null&&top!==lastInlineTop)visualTop=top;lastInlineTop=top;visualTop=Math.max(8,Math.min(visualTop,innerHeight-height-8));set('--echo-open-height',height+'px');set('--echo-open-top',visualTop+'px');
  }
  function hide(){current=null;visualTop=null;lastInlineTop=null;tray.hidden=true;panel.scrollTop=0;panel.classList.remove('echo-options-open');hideNiceOptions()}
  function sync(){
   hide();panel.classList.toggle('echo-options-lab',enabled());
   if(enabled()){panel.querySelector('.lab-panel-grip').after(tray);original.forEach(({button},i)=>button.textContent=definitions['🔥 ナイスプレー'][i].label)}
   else{tray.remove();original.forEach(({button,text})=>button.textContent=text)}
  }
  function open(kind){
   if(!enabled()||panel.hidden||document.body.classList.contains('lab-clean'))return;
   current=kind;choices.replaceChildren();tray.hidden=false;panel.classList.add('echo-options-open');
   if(kind==='🔥 ナイスプレー'){choices.append(options);showNiceOptions()}
   else{hideNiceOptions();for(const [index,option]of (definitions[kind]||[]).entries()){
    const button=document.createElement('button');button.type='button';button.className='echo-lab-option';button.textContent=option.label;button.onclick=()=>{
     if(!enabled())return;const item={experimental:true,parent_kind:kind,option_id:index,label:option.label,good_time:nowTime(3),video_id:typeof match!=='undefined'?`${match.id}:${currentPart}`:''};experimental.push(item);fly('[LAB] '+kind+'・'+option.label);hide();
    };choices.append(button);
   }}
   fit();
  }
  close.onclick=hide;
  for(const button of reactions)if(button.dataset.kind&&button.id!=='niceButton')button.addEventListener('click',()=>{if(enabled())open(button.dataset.kind)});
  new MutationObserver(fit).observe(panel,{attributes:true,attributeFilter:['style']});new ResizeObserver(fit).observe(panel);window.addEventListener('resize',fit);
  window.PULSE_ECHO_OPTION_EXPERIMENTS=Object.freeze({definitions,rows:()=>experimental.map(row=>({...row})),clear:()=>{experimental.length=0}});
  return{enabled,open,close:hide,sync};
 }
 window.PULSE_ECHO_OPTIONS_LAB=Object.freeze({create});
})();
