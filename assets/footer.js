const leaf = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 4c-9-1-15 2-15 8a6 6 0 0 0 6 6c6 0 9-6 9-14Z"/><path d="M4 21 15 10"/></svg>';

/** Public destinations only. The same static shell is used by the standalone notice. */
export function footerMarkup({ page = '' } = {}) {
  return `<div class="wrap footer-grid">
    <div class="footer-identity"><a class="brand" href="index.html" aria-label="Mon BPREA · Accueil"><span class="brand-symbol">${leaf}</span><span class="brand-copy"><b>BPREA<span class="brand-dot">.</span></b><small>Mon espace de révision</small></span></a><p>Un espace pour apprendre,<br>cultiver ses connaissances.</p></div>
    <nav class="footer-column" aria-label="Navigation de bas de page"><h2>Navigation</h2><ul><li><a href="index.html">Accueil</a></li><li><a href="mes-cours.html">Mes cours</a></li><li><a href="outils.html">Outils</a></li><li><a data-footer-account href="connexion.html">Connexion</a></li></ul></nav>
    <nav class="footer-column" aria-label="Ressources utiles"><h2>Ressources</h2><ul><li><a href="ressources.html">Ressources documentaires</a></li><li><a href="calendrier.html">Calendrier</a></li><li><a href="contact.html">Contact et assistance</a></li></ul></nav>
    <nav class="footer-column" aria-label="Informations et préférences"><h2>Informations</h2><ul><li><a href="confidentialite.html">Confidentialité</a></li><li><a href="profil.html#parametres">Paramètres</a></li></ul></nav>
  </div><div class="wrap footer-bottom"><span>© Mon BPREA · Projet personnel indépendant</span><span id="footer-progress-source">Contenus de démonstration non officiels${page ? ` · ${page === 'dashboard' ? 'Source des résultats précisée dans le Tableau de bord' : 'Données pédagogiques conservées sur cet appareil'}` : ''}</span></div>
  <svg class="footer-landscape" viewBox="0 0 1440 180" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path fill="currentColor" opacity=".07" d="M0 120C160 8 300 170 500 125S800 12 1010 75s300-85 430-35v140H0Z"/><path fill="currentColor" opacity=".1" d="M0 170c220-65 350 35 560-20S940 75 1100 125s230-70 340-45v100H0Z"/><g fill="none" stroke="currentColor" stroke-width="1" opacity=".12"><path d="M800 180c180-70 400-55 640-90M950 180c120-50 330-60 490-75M1110 180c80-40 210-50 330-60"/></g></svg>`;
}

export async function initFooter(root, { page } = {}) {
  if (!root) return;
  root.classList.add('site-footer');
  root.innerHTML = footerMarkup({ page });
  const account = root.querySelector('[data-footer-account]');
  try {
    const { getAuthService } = await import('./auth-service.js');
    const service = await getAuthService();
    service.subscribe(state => {
      const hasAccount = ['authenticated', 'offline'].includes(state.status) && Boolean(state.user);
      account.href = hasAccount ? 'profil.html' : 'connexion.html';
      account.textContent = hasAccount ? 'Mon profil' : 'Connexion';
    });
  } catch { /* Les destinations publiques restent disponibles si Auth échoue. */ }
}
