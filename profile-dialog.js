/* Keep name dialogs reachable in short visual viewports, without forcing a keyboard on entry. */
(() => {
 const bound=new WeakSet(),tv=new URLSearchParams(location.search).get('mode')==='tv';
 function bind(dialog){
  if(bound.has(dialog))return;bound.add(dialog);let restore=null,opened=false;
  const visible=node=>node&&!node.disabled&&node.getClientRects().length;
  function changed(){
   if(!dialog.hidden&&!opened){restore=document.querySelector('[aria-controls="'+dialog.id+'"]')||document.activeElement;opened=true;const initial=dialog.querySelector('#profileNameSkip');if(initial)initial.focus({preventScroll:true})}
   else if(dialog.hidden&&opened){opened=false;const target=tv&&dialog.id==='profileSetup'?document.getElementById('tvHome')||restore:restore;if(visible(target))target.focus({preventScroll:true})}
  }
  dialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const items=[...dialog.querySelectorAll('input,button,a[href],[tabindex]')].filter(n=>n.tabIndex>=0&&visible(n));if(!items.length)return;const index=items.indexOf(document.activeElement);if(index<0||event.shiftKey&&index===0||!event.shiftKey&&index===items.length-1){event.preventDefault();items[event.shiftKey?items.length-1:0].focus()}});
  if(tv)document.addEventListener('focusin',event=>{if(dialog.hidden||dialog.contains(event.target))return;const first=dialog.querySelector('#profileNameSkip')||dialog.querySelector('input, button');first?.focus({preventScroll:true})});
  new MutationObserver(changed).observe(dialog,{attributes:true,attributeFilter:['hidden']});changed();
 }
 function scan(){document.querySelectorAll('.profile-setup').forEach(bind)}
 function size(){const v=window.visualViewport;document.documentElement.style.setProperty('--profile-height',(v?v.height:innerHeight)+'px');document.documentElement.style.setProperty('--profile-top',(v?v.offsetTop:0)+'px')}
 function start(){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});size();window.visualViewport?.addEventListener('resize',size);window.visualViewport?.addEventListener('scroll',size);window.addEventListener('resize',size)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
