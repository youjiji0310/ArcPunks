(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  var targets = Array.prototype.slice.call(
    document.querySelectorAll('.community-section, .stats')
  );
  if (!targets.length) return;

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('hc-in');
      }
    });
  }, { threshold: 0.25 });

  targets.forEach(function (el) { io.observe(el); });
})();