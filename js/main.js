const PUNK_COUNT = 17;
const punkImages = Array.from({ length: PUNK_COUNT }, (_, i) => `assets/images/punks/${i + 1}.png`);

// Grille de la hero — cycle sur tes vraies images, fondu à droite
const grid = document.getElementById('punkGrid');
if (grid) {
  const totalCells = 20;
  let html = '';
  for (let i = 0; i < totalCells; i++) {
    const src = punkImages[i % PUNK_COUNT];
    const selected = i === 0 ? ' selected' : '';
    html += `<div class="punk-card${selected}"><img src="${src}" alt="ArcPunk"></div>`;
  }
  grid.innerHTML = html;
}

// Bandeau infini avec chips texte
const track = document.getElementById('marqueeTrack');
if (track) {
  const labels = ['10,000 ARCPUNKS', 'MINT SOON', 'BUILT ON ARC L1'];
  const items = [];
  punkImages.forEach((src, i) => {
    items.push({ type: 'img', src });
    if (i % 3 === 2) items.push({ type: 'text', text: labels[(i / 3) % labels.length] });
  });
  [...items, ...items].forEach((item) => {
    if (item.type === 'img') {
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = 'ArcPunk';
      img.className = 'marquee-item';
      track.appendChild(img);
    } else {
      const span = document.createElement('span');
      span.className = 'marquee-text';
      span.textContent = item.text;
      track.appendChild(span);
    }
  });
}