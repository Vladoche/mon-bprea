// Exécuté avant la feuille de style pour éviter un flash du thème clair.
(function () {
  let saved = 'light';
  try { saved = localStorage.getItem('bprea-demo-theme-v1') || 'light'; } catch {}
  document.documentElement.dataset.theme = saved === 'dark' ? 'dark' : 'light';
})();
