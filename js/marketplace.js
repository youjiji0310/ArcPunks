document.addEventListener('DOMContentLoaded', () => {
  // Réutilise le même effet mosaïque que la home, dans un container dédié
  const soonMosaic = document.getElementById('soonMosaic');
  const cellCount = 40;

  for (let i = 0; i < cellCount; i++) {
    const cell = document.createElement('div');
    soonMosaic.appendChild(cell);
  }

  const cells = soonMosaic.querySelectorAll('div');
  const colors = ['#B7BEF2', '#1F5C56', '#16294F', 'rgba(183,190,242,0.15)'];

  setInterval(() => {
    const randomCell = cells[Math.floor(Math.random() * cells.length)];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    randomCell.style.background = randomColor;
    setTimeout(() => {
      randomCell.style.background = 'rgba(183, 190, 242, 0.15)';
    }, 800);
  }, 150);

  // Notify form (mock — pas de backend pour l'instant)
  const notifyBtn = document.getElementById('notifyBtn');
  const notifyInput = document.getElementById('notifyInput');

  notifyBtn.addEventListener('click', () => {
    const email = notifyInput.value.trim();
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email.');
      return;
    }
    notifyBtn.textContent = 'You\'re on the list!';
    notifyInput.value = '';
    setTimeout(() => { notifyBtn.textContent = 'Me prévenir'; }, 2000);
  });
});