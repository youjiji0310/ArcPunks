// Effets d'ambiance : fumée qui monte, mascottes fantômes, particules
(function () {
  const wispWrap = document.getElementById('wisps');
  if (wispWrap) {
    const wispCount = 9;
    let wispHTML = '';
    for (let i = 0; i < wispCount; i++) {
      const left = Math.random() * 100;
      const size = 220 + Math.random() * 260;
      const delay = Math.random() * 20;
      const duration = 16 + Math.random() * 14;
      const drift = (Math.random() * 140 - 70).toFixed(0) + 'px';
      wispHTML += `<span style="left:${left}%; width:${size}px; height:${size}px; animation-delay:${delay}s; animation-duration:${duration}s; --wdrift:${drift};"></span>`;
    }
    wispWrap.innerHTML = wispHTML;
  }

  function ghostSVG() {
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="30" y="10" width="40" height="10" fill="#bdf1ff" opacity="0.85"/>
      <rect x="20" y="20" width="60" height="10" fill="#bdf1ff" opacity="0.85"/>
      <rect x="20" y="30" width="60" height="30" fill="#bdf1ff" opacity="0.85"/>
      <rect x="20" y="60" width="10" height="10" fill="#bdf1ff" opacity="0.85"/>
      <rect x="40" y="60" width="10" height="10" fill="#bdf1ff" opacity="0.85"/>
      <rect x="60" y="60" width="10" height="10" fill="#bdf1ff" opacity="0.85"/>
      <rect x="30" y="60" width="10" height="10" fill="#0b2338" opacity="0.9"/>
      <rect x="50" y="60" width="10" height="10" fill="#0b2338" opacity="0.9"/>
      <rect x="70" y="60" width="10" height="10" fill="#0b2338" opacity="0.9"/>
      <rect x="35" y="35" width="8" height="10" fill="#0b2338"/>
      <rect x="57" y="35" width="8" height="10" fill="#0b2338"/>
    </svg>`;
  }
  const ghost1 = document.getElementById('ghost1');
  const ghost2 = document.getElementById('ghost2');
  if (ghost1) ghost1.innerHTML = ghostSVG();
  if (ghost2) ghost2.innerHTML = ghostSVG();

  const sparkWrap = document.getElementById('sparks');
  if (sparkWrap) {
    const sparkCount = 22;
    let sparkHTML = '';
    for (let i = 0; i < sparkCount; i++) {
      const left = Math.random() * 100;
      const delay = Math.random() * 8;
      const duration = 6 + Math.random() * 6;
      const drift = (Math.random() * 60 - 30).toFixed(0) + 'px';
      sparkHTML += `<span style="left:${left}%; animation-delay:${delay}s; animation-duration:${duration}s; --drift:${drift};"></span>`;
    }
    sparkWrap.innerHTML = sparkHTML;
  }
})();