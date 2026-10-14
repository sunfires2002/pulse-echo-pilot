/* Scope the overlay to touch phones; tablets and desktop modes retain their layout. */
(() => {
 function update(){
  const ua=navigator.userAgent;
  const phone=/Android/.test(ua)&&/Mobile/.test(ua)||/iPhone|iPod/.test(ua);
  const shortSide=Math.min(screen.width,screen.height);
  document.body.classList.toggle('phone-layout',phone&&shortSide>0&&shortSide<=500&&matchMedia('(pointer:coarse)').matches);
 }
 update();window.addEventListener('resize',update);window.addEventListener('orientationchange',update);
})();
