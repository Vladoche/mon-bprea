import { getAuthService } from './auth-service.js';

const paths = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  logout: '<path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h11"/>',
};
const icon = name => `<svg class="primary-nav__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;

/** Presentation only: identity, sign-out and local data remain owned by Auth. */
export async function initAuthHeader(root, page = document.body.dataset.page) {
  if (!root) return;
  const loading = () => {
    root.classList.remove('active');
    root.innerHTML = `<div class="primary-nav__entry"><span class="primary-nav__top-link" role="status">${icon('user')}<span>Vérification…</span></span></div>`;
  };
  loading();
  let service;
  try { service = await getAuthService(); }
  catch {
    root.innerHTML = `<div class="primary-nav__entry"><a class="primary-nav__top-link account-link" href="connexion.html">${icon('user')}<span>Connexion</span></a></div>`;
    return;
  }
  if (!root.isConnected) return;
  let panel = null;
  let renderedState = null;
  // The service belongs to this document. Keep its subscription through BFCache
  // so a restored header follows the current identity, like the original shell.
  service.subscribe(state => {
    const nextState = JSON.stringify([state.status, state.user?.id, state.error]);
    if (nextState === renderedState) return;
    renderedState = nextState;
    // A network outage with a recognized local identity is not a sign-out.
    const recognized = ['authenticated', 'offline'].includes(state.status) && !!state.user;
    const focused = root.contains(document.activeElement) || panel?.contains(document.activeElement);
    panel?.remove(); panel = null;
    root.classList.toggle('active', recognized && page === 'profile' || !recognized && page === 'auth-login');
    if (state.status === 'loading') {
      loading();
      if (focused) root.closest('nav').querySelector('a')?.focus();
      return;
    }
    root.innerHTML = `<div class="primary-nav__entry"><a class="primary-nav__top-link account-link" href="${recognized ? 'profil.html' : 'connexion.html'}"${recognized && page === 'profile' || !recognized && page === 'auth-login' ? ' aria-current="page"' : ''}>${icon('user')}<span>${recognized ? 'Mon profil' : 'Connexion'}</span></a>${recognized ? '<button class="primary-nav__toggle" type="button" data-navigation-toggle="profile" aria-expanded="false" aria-controls="primary-navigation-profile-panel" aria-label="Afficher les sous-rubriques de Mon profil"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>' : ''}</div>${recognized ? `<div class="primary-nav__panel primary-nav__panel--profile" id="primary-navigation-profile-panel" role="group" aria-label="Destinations du compte" hidden><ul class="primary-nav__links"><li><a class="primary-nav__link" href="profil.html#informations-compte">${icon('user')}Informations du compte</a></li><li><a class="primary-nav__link" href="profil.html#parametres">${icon('settings')}Paramètres</a></li><li class="account-signout-row"><button class="primary-nav__link account-signout" type="button">${icon('logout')}Déconnexion</button></li></ul></div>` : ''}<span class="account-feedback" role="alert"></span><span class="sr-only" role="status"></span>`;
    panel = root.querySelector('.primary-nav__panel--profile');
    if (panel) root.closest('nav').append(panel);
    if (state.status === 'offline') root.querySelector('[role="status"]').textContent = 'Hors ligne. Identité locale reconnue ; connexion au compte à vérifier.';
    else if (['error', 'unavailable'].includes(state.status)) root.querySelector('[role="status"]').textContent = state.error || 'Le service de compte est indisponible.';
    panel?.querySelector('.account-signout')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try { await service.signOut(); }
      catch (error) {
        const output = root.querySelector('.account-feedback');
        if (output) output.textContent = error.message || 'La déconnexion a échoué. Réessaie.';
      }
      finally { if (button.isConnected) button.disabled = false; }
      root.querySelector('.account-link')?.focus();
    });
    if (focused) root.querySelector('.account-link')?.focus();
  });
}
