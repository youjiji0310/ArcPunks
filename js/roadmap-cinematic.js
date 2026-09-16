(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scenes = Array.prototype.slice.call(document.querySelectorAll('.roadmap-scene'));
  if (!scenes.length) return;

  /* Reveal each scene once it enters the viewport */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('rc-in');
      }
    });
  }, { threshold: 0.28 });

  scenes.forEach(function (scene) { io.observe(scene); });

  if (reduceMotion) return;

  /* Build the progress rail: one dot per scene, injected once */
  var rail = document.createElement('div');
  rail.className = 'roadmap-rail';
  rail.setAttribute('aria-hidden', 'true');
  rail.innerHTML =
    '<div class="roadmap-rail-line"><div class="roadmap-rail-fill" id="rcRailFill"></div></div>' +
    '<div class="roadmap-rail-nodes">' +
    scenes.map(function () { return '<span class="rail-node"></span>'; }).join('') +
    '</div>';
  document.body.appendChild(rail);

  var railFill = rail.querySelector('#rcRailFill');
  var nodes = Array.prototype.slice.call(rail.querySelectorAll('.rail-node'));
  var images = scenes.map(function (s) { return s.querySelector('.roadmap-scene-media img'); });

  var ticking = false;

  function update() {
    ticking = false;
    var viewportH = window.innerHeight;
    var viewportCenter = viewportH / 2;

    var first = scenes[0].getBoundingClientRect();
    var last = scenes[scenes.length - 1].getBoundingClientRect();
    var trackStart = first.top + window.scrollY + first.height * 0.2;
    var trackEnd = last.top + window.scrollY + last.height * 0.8;
    var scrollY = window.scrollY + viewportCenter;

    var progress = (scrollY - trackStart) / (trackEnd - trackStart);
    progress = Math.max(0, Math.min(1, progress));
    railFill.style.height = (progress * 100) + '%';

    var closestIndex = 0;
    var closestDist = Infinity;

    scenes.forEach(function (scene, i) {
      var rect = scene.getBoundingClientRect();
      var dist = Math.abs((rect.top + rect.height / 2) - viewportCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }

      /* gentle parallax: image drifts a few px opposite scroll direction */
      var offset = ((rect.top + rect.height / 2) - viewportCenter) / viewportH;
      var px = Math.max(-18, Math.min(18, offset * -24));
      var img = images[i];
      if (img) img.style.setProperty('--rc-parallax', px.toFixed(1) + 'px');
    });

    nodes.forEach(function (node, i) {
      node.classList.toggle('is-active', i === closestIndex);
    });
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();
