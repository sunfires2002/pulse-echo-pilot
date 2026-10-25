/* LAB-only feature icon comparison. Original panels and interaction are untouched. */
(() => {
  if (!window.PULSE_PC_DESKTOP) return;
  const boot = () => {
    const body = document.body;
    const sheet = document.createElement('style');
    sheet.textContent = `
      body.tv-mode.lab-mode .lab-feature-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:var(--lab-feature-icon-size,20px);height:var(--lab-feature-icon-size,20px);vertical-align:middle}
      body.tv-mode.lab-mode .lab-feature-icon svg{display:block;width:100%;height:100%;overflow:visible}
      body.tv-mode.lab-mode .lab-panel-grip>span,body.tv-mode.lab-mode #labMapHandle>span,body.tv-mode.lab-mode #labMenuToggle{display:flex;align-items:center;gap:6px}
      body.tv-mode.lab-mode .lab-feature-icon-settings{padding:8px 0;border-top:1px solid #657087;margin-top:8px}
      body.tv-mode.lab-mode .lab-feature-icon-settings h2{margin:0 0 6px;font-size:13px;color:#d8dfec}
      body.tv-mode.lab-mode .lab-feature-icon-options{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:5px 0}
      body.tv-mode.lab-mode .lab-feature-icon-options>span{font-size:12px;color:#b8c1d2}
      body.tv-mode.lab-mode .lab-feature-icon-options .btn{min-height:30px;padding:4px 8px;font-size:12px}
      body.tv-mode.lab-mode .lab-feature-icon-options .btn[aria-pressed=true]{border-color:#00cec9;box-shadow:inset 0 0 0 1px #00cec9}
    `;
    document.head.append(sheet);
    let roomVariant = 'new';
    let iconSize = 20;
    const asset = 'pc-lab-feature-icons.svg';
    const iconFor = (key) => key === 'room' ? `room-${roomVariant}` : key;
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
      let label = target.querySelector('span');
      if (!label) { label = document.createElement('span'); label.textContent = target.textContent.trim(); target.replaceChildren(label); }
      target.dataset.featureIcon = key;
      label.prepend(makeIcon(key));
    }
    function addSettings(controls) {
      if (!controls || controls.querySelector('.lab-feature-icon-settings')) return;
      const section = document.createElement('section');
      section.className = 'lab-feature-icon-settings';
      section.setAttribute('aria-label','機能アイコン比較設定');
      const title = document.createElement('h2'); title.textContent = 'アイコン比較'; section.append(title);
      const sizes = document.createElement('div'); sizes.className = 'lab-feature-icon-options';
      const sizeLabel = document.createElement('span'); sizeLabel.textContent = 'サイズ'; sizes.append(sizeLabel);
      for (const size of [20,24]) {
        const button = document.createElement('button'); button.type='button'; button.className='btn';
        button.textContent = `${size}px`; button.dataset.iconSize = String(size);
        button.setAttribute('aria-pressed', String(iconSize === size));
        button.addEventListener('click', () => { iconSize = size; update(); });
        sizes.append(button);
      }
      const rooms = document.createElement('div'); rooms.className = 'lab-feature-icon-options';
      const roomLabel = document.createElement('span'); roomLabel.textContent = 'ROOM'; rooms.append(roomLabel);
      for (const variant of ['new','new2']) {
        const button = document.createElement('button'); button.type='button'; button.className='btn';
        button.textContent = variant === 'new' ? '新' : '新2'; button.dataset.roomVariant = variant;
        button.setAttribute('aria-pressed', String(roomVariant === variant));
        button.addEventListener('click', () => { roomVariant = variant; update(); });
        rooms.append(button);
      }
      section.append(sizes,rooms); controls.append(section);
    }
    function update() {
      body.style.setProperty('--lab-feature-icon-size', `${iconSize}px`);
      document.querySelectorAll('.lab-feature-icon').forEach(box => {
        const use = box.querySelector('use');
        use?.setAttribute('href', `${asset}#${iconFor(box.dataset.iconKey)}`);
      });
      document.querySelectorAll('[data-icon-size]').forEach(button => button.setAttribute('aria-pressed',String(Number(button.dataset.iconSize) === iconSize)));
      document.querySelectorAll('[data-room-variant]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.roomVariant === roomVariant)));
    }
    function attach() {
      header(document.getElementById('labMapHandle'),'pulse');
      header(document.querySelector('#labReactions .lab-panel-grip'),'echo');
      header(document.querySelector('#labPosting .lab-panel-grip'),'echo-plus');
      header(document.querySelector('#labTimeline .lab-panel-grip'),'react-new2');
      header(document.querySelector('#labMatchLog .lab-panel-grip'),'match-log-new2');
      header(document.getElementById('labMenuToggle'),'room');
      addSettings(document.getElementById('labControls'));
      update();
    }
    const observer = new MutationObserver(attach);
    observer.observe(body,{childList:true,subtree:true});
    document.addEventListener('pulse-view-mode',attach);
    attach();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
