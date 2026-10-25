/* LAB-only fixed feature icons. Keep the room symbol available for a future room entry. */
(() => {
  if (!window.PULSE_PC_DESKTOP) return;
  const boot = () => {
    const body = document.body;
    const sheet = document.createElement('style');
    sheet.textContent = `
      body.tv-mode.lab-mode .lab-feature-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 24px;width:24px;height:24px;vertical-align:middle}
      body.tv-mode.lab-mode .lab-feature-icon svg{display:block;width:100%;height:100%;overflow:visible}
      body.tv-mode.lab-mode .lab-grip-line{display:flex;align-items:center;gap:6px}
      body.tv-mode.lab-mode .lab-grip-title{display:inline-flex;align-items:center;gap:6px}
    `;
    document.head.append(sheet);
    const asset = 'pc-lab-feature-icons.svg';
    const iconFor = key => key === 'room' ? 'room-new2' : key;
    function makeIcon(key) {
      const box = document.createElement('span');
      box.className = 'lab-feature-icon';
      box.setAttribute('aria-hidden', 'true');
      box.dataset.iconKey = key;
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 48 48');
      const use = document.createElementNS('http://www.w3.org/2000/svg','use');
      use.setAttribute('href', `${asset}#${iconFor(key)}`);
      svg.append(use); box.append(svg);
      return box;
    }
    function header(target, key) {
      if (!target || target.dataset.featureIcon === key) return;
      let label = target.querySelector('.lab-grip-title') || target.querySelector('span');
      if (!label) { label = document.createElement('span'); label.textContent = target.textContent.trim(); target.replaceChildren(label); }
      target.dataset.featureIcon = key;
      label.prepend(makeIcon(key));
    }
    function attach() {
      header(document.getElementById('labMapHandle'),'pulse');
      header(document.querySelector('#labReactions .lab-panel-grip'),'echo');
      header(document.querySelector('#labPosting .lab-panel-grip'),'echo-plus');
      header(document.querySelector('#labTimeline .lab-panel-grip'),'react-new2');
      header(document.querySelector('#labMatchLog .lab-panel-grip'),'match-log-new2');
    }
    const observer = new MutationObserver(attach);
    observer.observe(body,{childList:true,subtree:true});
    document.addEventListener('pulse-view-mode',attach);
    attach();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
