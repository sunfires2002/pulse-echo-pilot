/* Normal room viewing only. Platform limits scope; available geometry decides layout. */
(() => {
 const body=document.body,root=document.documentElement;
 function update(){
  const viewport=window.visualViewport;
  const width=Math.min(innerWidth,viewport?.width||innerWidth);
  const height=Math.min(innerHeight,viewport?.height||innerHeight);
  const mode=new URLSearchParams(location.search).get('mode');
  const supported=/Android|iPhone|iPod/.test(navigator.userAgent)&&navigator.maxTouchPoints>0;
  const active=supported&&width>height&&width<=1280&&height<=800&&mode!=='tv'&&mode!=='lab'&&!body.classList.contains('tv-mode');
  body.classList.remove('phone-layout');body.classList.toggle('room-landscape',active);root.classList.toggle('room-landscape',active);
  if(!active){delete body.dataset.roomButtons;delete body.dataset.roomCompact;return}
  const videoWidth=Math.min(width,height*16/9),videoHeight=videoWidth*9/16;
  const size=Math.max(48,Math.min(64,height*.13)),gap=Math.max(5,Math.min(8,height*.018));
  const compact=4*size+3*gap+16>height;
  const rail=(compact?2*size+gap:size)+16;
  const spare=(width-videoWidth)/2;
  const values={width,height,left:viewport?.offsetLeft||0,top:viewport?.offsetTop||0,
   'video-width':videoWidth,'video-height':videoHeight,'button-size':size,'button-gap':gap,'rail-width':rail};
  Object.entries(values).forEach(([key,value])=>body.style.setProperty('--room-'+key,value+'px'));
  body.dataset.roomButtons=spare>=rail?'margin':'overlay';body.dataset.roomCompact=String(compact);
 }
 update();window.addEventListener('resize',update);window.addEventListener('orientationchange',update);
 window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);
 document.addEventListener('pulse-view-mode',update);
})();
