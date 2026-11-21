import { getAuthService } from './auth-service.js';
import { validateCredentials, validatePassword, validatePseudo } from './auth-validation.js';
import { renderBreadcrumbs } from './breadcrumbs.js';

const controllers = new WeakMap();
const restoreHandlers = new WeakSet();
const descriptions = {
  'auth-login': ['Connexion', 'Retrouve ton espace personnel avec ton compte invité.'],
  'auth-reset': ['Mot de passe oublié', 'Une récupération personnelle, avec la personne qui t’a invité.'],
  'auth-callback': ['Activation et mot de passe', 'Finalise ton invitation ou réinitialise ton mot de passe.'],
};
const emailField = `<div class="auth-field"><label for="auth-email">Adresse e-mail</label><input id="auth-email" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="254" required></div>`;
const passwordFields = `<div class="auth-field"><label for="auth-password">Nouveau mot de passe</label><input id="auth-password" name="password" type="password" autocomplete="new-password" aria-describedby="auth-password-help" required><small id="auth-password-help">De 12 à 128 caractères. Choisis un mot de passe unique pour ce compte.</small></div><div class="auth-field"><label for="auth-confirmation">Confirmer le mot de passe</label><input id="auth-confirmation" name="confirmation" type="password" autocomplete="new-password" required></div>`;

/** Only fixed interface markup is rendered as HTML; account data uses textContent. */
export async function initAuthPage(root = document.querySelector('#app-main')) {
  if (!root) return;
  controllers.get(root)?.();
  const page = document.body.dataset.page;
  if (page === 'profile') {
    controllers.set(root, initProfilePage(root));
    return;
  }
  if (!descriptions[page]) return;
  const abort = new AbortController();
  let unsubscribe = () => {};
  let disposed = false;
  const dispose = () => {
    disposed = true;
    abort.abort();
    unsubscribe();
    link = null;
    for (const input of root.querySelectorAll('input[type="password"]')) input.value = '';
    if (page === 'auth-callback') root.textContent = 'Vérification de la session…';
  };
  controllers.set(root, dispose);
  window.addEventListener('pagehide', dispose, { once: true, signal: abort.signal });
  if (!restoreHandlers.has(root)) {
    restoreHandlers.add(root);
    window.addEventListener('pageshow', event => { if (event.persisted) initAuthPage(root); });
  }
  // The callback document captured and removed these values before loading modules.
  let link = page === 'auth-callback' ? window.__bpreaAuthLink : null;
  if (page === 'auth-callback') delete window.__bpreaAuthLink;
  root.innerHTML = `<section class="page-top wrap auth-top">${renderBreadcrumbs(page)}<div class="page-eyebrow">TON ESPACE PERSONNEL</div><h1></h1><p></p><p class="auth-help"><a href="confidentialite.html#compte-et-invitation">Confidentialité du compte et des invitations</a></p></section><div class="wrap auth-layout"><section class="auth-panel" aria-label="Compte personnel"><p class="auth-message" role="status">Chargement du compte…</p></section><aside class="auth-aside"><h2>Un compte sur invitation</h2><p>La personne qui t’invite te transmet individuellement un lien personnel. Il n’y a pas d’inscription libre.</p><p>Les cours et les outils publics restent disponibles sans connexion.</p><p><a href="contact.html">Contact et assistance, même sans compte</a></p><p><a href="mes-cours.html">Parcourir mes cours</a></p><p class="auth-help">En visiteur, l’historique des exercices hebdomadaires reste sur cet appareil. Lorsque l’espace personnel est activé, les réponses du compte alimentent son tableau de bord et se synchronisent ; celles en attente ne sont pas encore confirmées sur les autres appareils.</p></aside></div>`;
  root.querySelector('h1').textContent = descriptions[page][0];
  root.querySelector('.auth-top > p').textContent = descriptions[page][1];
  const panel = root.querySelector('.auth-panel');
  if (page === 'auth-reset') {
    panel.innerHTML = '<h2>Récupérer ton compte avec assistance</h2><p>Les comptes Mon BPREA sont gérés personnellement, sans service d’envoi automatique d’e-mails.</p><p>Pour récupérer ton compte, écris via le <a href="contact.html">contact officiel, accessible sans connexion</a>. Tu peux aussi joindre la personne qui t’a invité par votre moyen de communication habituel.</p><p>Après vérification de ton identité, elle pourra te transmettre un lien personnel pour choisir un nouveau mot de passe.</p><p>Ne communique jamais ton mot de passe ni ton lien personnel.</p><div class="auth-links"><a href="connexion.html">Retour à la connexion</a></div>';
    return;
  }
  let service;
  try { service = await getAuthService(); }
  catch { if (!disposed) panel.innerHTML = '<h2>Connexion indisponible</h2><p>Le service de compte ne peut pas être chargé. Recharge la page pour réessayer.</p>'; return; }
  if (disposed) return;
  function message(text, kind = 'info', focus = false) {
    const output = panel.querySelector('[data-auth-message]');
    if (!output) return;
    output.textContent = text;
    output.dataset.kind = kind;
    output.hidden = !text;
    output.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    if (focus && text) output.focus();
  }
  function messageMarkup() { return '<p class="auth-message" data-auth-message role="status" tabindex="-1" hidden></p>'; }
  function busy(form, value) {
    panel.setAttribute('aria-busy', String(value));
    for (const field of form?.elements || []) field.disabled = value;
  }
  function clearValidation(form) {
    for (const field of form.elements) field.removeAttribute('aria-invalid');
  }
  function invalid(form, text, names) {
    for (const name of names) form.elements.namedItem(name)?.setAttribute('aria-invalid', 'true');
    message(text, 'error', true);
  }
  const safeError = error => error?.message || 'Le service est momentanément indisponible. Réessaie dans un instant.';
  const listen = (node, event, callback) => node.addEventListener(event, callback, { signal: abort.signal });

  if (page === 'auth-login') {
    panel.innerHTML = `<h2>Se connecter</h2>${messageMarkup()}<form class="auth-form">${emailField}<div class="auth-field"><label for="auth-password">Mot de passe</label><input id="auth-password" name="password" type="password" autocomplete="current-password" required></div><button class="btn btn-surface btn-surface--accent" type="submit">Se connecter</button></form><div class="auth-links"><a href="mot-de-passe-oublie.html">Mot de passe oublié</a><a href="profil.html" data-profile-link hidden>Mon profil</a></div>`;
    const form = panel.querySelector('form');
    let pending = false;
    unsubscribe = service.subscribe(state => {
      if (disposed) return;
      const authenticated = state.status === 'authenticated';
      form.hidden = authenticated;
      panel.querySelector('[data-profile-link]').hidden = !authenticated;
      busy(form, pending || state.status === 'loading' || state.status === 'unavailable');
      if (authenticated) message('Tu es déjà connecté. Tu peux consulter ton profil.', 'success');
      else if (state.status === 'unavailable') message(state.error || 'La connexion n’est pas encore configurée sur cet environnement.', 'error');
      else if (state.status === 'loading') message('Vérification de la session…');
      else if (state.status === 'error') message(state.error || 'Impossible de vérifier la session. Tu peux réessayer de te connecter.', 'error');
      else if (!pending) message('');
    });
    listen(form, 'submit', async event => {
      event.preventDefault();
      if (pending) return;
      clearValidation(form);
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      const error = validateCredentials(email, password);
      if (error) { invalid(form, error, ['email', 'password']); return; }
      pending = true; busy(form, true); message('Connexion en cours…');
      try { await service.signIn(email, password); if (!disposed) location.assign('profil.html'); }
      catch (error) { if (!disposed) message(safeError(error), 'error', true); }
      finally {
        pending = false;
        form.elements.password.value = '';
        if (!disposed) busy(form, false);
      }
    });
    return;
  }

  if (page === 'auth-callback') {
    let verified = false;
    let completed = false;
    let pending = false;
    const linkType = link?.type;
    function invalidLink() {
      link = null;
      panel.innerHTML = '<h2>Lien invalide ou expiré</h2><p role="alert">Ce lien ne peut pas être utilisé. Il peut avoir expiré ou avoir déjà été utilisé.</p><p>Consulte le <a href="contact.html">contact et l’assistance sans connexion</a> pour obtenir de l’aide.</p><div class="auth-links"><a href="mot-de-passe-oublie.html">Récupération assistée</a><a href="connexion.html">Connexion</a></div>';
    }
    if (!link) { invalidLink(); return; }
    panel.innerHTML = `<h2>${linkType === 'invite' ? 'Activer ton compte' : 'Réinitialiser ton mot de passe'}</h2>${messageMarkup()}<p>Pour vérifier le lien personnel qui t’a été transmis, utilise le bouton ci-dessous. Tu pourras ensuite choisir ton mot de passe.</p><button class="btn btn-surface btn-surface--accent" type="button" data-continue>${linkType === 'invite' ? 'Continuer l’activation' : 'Continuer la réinitialisation'}</button><div class="auth-links"><a href="connexion.html">Annuler</a></div>`;
    const continueButton = panel.querySelector('[data-continue]');
    unsubscribe = service.subscribe(state => {
      if (disposed || completed) return;
      if (verified && state.status !== 'authenticated') { verified = false; invalidLink(); return; }
      if (!verified) {
        continueButton.disabled = pending || state.status === 'loading' || state.status === 'unavailable';
        if (state.status === 'unavailable') message(state.error || 'La vérification du lien n’est pas encore configurée.', 'error');
      }
    });
    listen(continueButton, 'click', async () => {
      if (pending || !link) return;
      pending = true; continueButton.disabled = true; panel.setAttribute('aria-busy', 'true'); message('Vérification du lien…');
      const credentials = link;
      link = null;
      try {
        await service.completeLink(credentials);
        if (disposed) return;
        if (service.getState().status !== 'authenticated') { invalidLink(); return; }
        verified = true;
        renderPasswordForm();
      } catch { if (!disposed) invalidLink(); }
      finally { pending = false; if (!disposed) panel.setAttribute('aria-busy', 'false'); }
    });
    function renderPasswordForm() {
      panel.innerHTML = `<h2>Choisir ton mot de passe</h2>${messageMarkup()}<form class="auth-form">${passwordFields}<button class="btn btn-surface btn-surface--accent" type="submit">Définir le mot de passe</button></form>`;
      const form = panel.querySelector('form');
      form.elements.password.focus();
      listen(form, 'submit', async event => {
        event.preventDefault();
        if (pending || !verified) return;
        clearValidation(form);
        const password = form.elements.password.value;
        const confirmation = form.elements.confirmation.value;
        const error = validatePassword(password, confirmation);
        if (error) { invalid(form, error, ['password', 'confirmation']); return; }
        pending = true; busy(form, true); message('Enregistrement du mot de passe…');
        try {
          await service.updatePassword(password);
          if (disposed) return;
          completed = true;
          panel.innerHTML = `<h2>${linkType === 'invite' ? 'Ton compte est activé' : 'Ton mot de passe est modifié'}</h2><p role="status">Ton nouveau mot de passe est enregistré. Tu peux maintenant consulter ton profil.</p><a class="btn btn-surface btn-surface--accent" href="profil.html">Mon profil</a>`;
        } catch (error) { if (!disposed && verified) message(safeError(error), 'error', true); }
        finally {
          pending = false;
          form.elements.password.value = '';
          form.elements.confirmation.value = '';
          if (!disposed) busy(form, false);
        }
      });
    }
    return;
  }

}

const profileChecking = '<p role="status">Vérification de la session…</p>';
const connectLink = '<a class="btn btn-surface" href="connexion.html">Connexion</a>';
const profileAccountMarkup = `
  <dl class="profile-details">
    <div><dt>Adresse e-mail</dt><dd data-email></dd></div>
    <div><dt>Compte créé le</dt><dd data-created></dd></div>
    <div><dt>Pseudo actuel</dt><dd data-current-pseudo></dd></div>
  </dl>
  <form class="auth-form profile-pseudo-form">
    <div class="auth-field">
      <label for="auth-pseudo">Pseudo (facultatif)</label>
      <input id="auth-pseudo" name="pseudo" type="text" autocomplete="nickname" aria-describedby="auth-pseudo-help profile-pseudo-message">
      <small id="auth-pseudo-help">De 2 à 40 caractères, ou laisse ce champ vide.</small>
    </div>
    <button class="btn btn-surface btn-surface--accent" type="submit">Enregistrer le pseudo</button>
  </form>
  <p class="auth-message profile-pseudo-message" id="profile-pseudo-message" data-auth-message role="status" aria-atomic="true"></p>
  <div class="profile-account-actions">
    <a class="ui-link" href="mot-de-passe-oublie.html">Récupération assistée du mot de passe</a>
    <button class="btn btn-surface" type="button" data-sign-out>Se déconnecter</button>
  </div>`;

function initProfilePage(root) {
  const controller = new AbortController();
  const { signal } = controller;
  const account = root.querySelector('[data-profile-account]');
  let unsubscribeAuth = () => {};
  root.querySelector('[data-profile-breadcrumb]').innerHTML = renderBreadcrumbs('profile');
  root.querySelector('#appearance-open').disabled = !document.getElementById('appearance-dialog');

  const dispose = () => {
    controller.abort();
    unsubscribeAuth();
    document.getElementById('appearance-dialog')?.close();
    account.innerHTML = profileChecking;
  };
  window.addEventListener('pagehide', dispose, { once: true, signal });
  // Recreate the Auth and settings subscribers together on a cached return.
  if (!restoreHandlers.has(root)) {
    restoreHandlers.add(root);
    window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  }

  getAuthService().then(service => {
    if (signal.aborted) return;
    unsubscribeAuth = initProfileAccount(account, service, signal);
    import('./parcours-ui.js').then(({ initParcours }) => {
      if (!signal.aborted) initParcours(root, service, signal);
    }).catch(() => {
      if (!signal.aborted) root.querySelector('#parcours-state').textContent = 'Le parcours est temporairement indisponible.';
    });
  }).catch(() => {
    if (!signal.aborted) account.innerHTML = '<h3>Connexion indisponible</h3><p role="alert">Le service de compte ne peut pas être chargé. Recharge la page pour réessayer.</p>';
  });
  return dispose;
}

function initProfileAccount(panel, service, signal) {
  let identity;
  let sequence = 0;
  let signingOut = false;
  const current = request => !signal.aborted && request === sequence;
  function paint(markup) {
    const focusWithin = panel.contains(document.activeElement);
    panel.innerHTML = markup;
    if (focusWithin) panel.closest('section').focus({ preventScroll: true });
  }
  function feedback(text, kind = 'info') {
    const node = panel.querySelector('[data-auth-message]');
    node.dataset.kind = kind;
    node.textContent = text || '';
  }
  function showPseudo(pseudo) {
    panel.querySelector('[data-current-pseudo]').textContent = pseudo || 'Aucun pseudo';
    panel.querySelector('#auth-pseudo').value = pseudo || '';
  }
  async function loadProfile(user) {
    const request = ++sequence;
    paint('<p role="status">Chargement du profil…</p>');
    try {
      const profile = await service.getProfile();
      if (!current(request)) return;
      paint(profileAccountMarkup);
      panel.querySelector('[data-email]').textContent = user.email || 'Adresse indisponible';
      const created = new Date(user.created_at);
      panel.querySelector('[data-created]').textContent = user.created_at && Number.isFinite(created.getTime())
        ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(created)
        : 'Date indisponible';
      showPseudo(profile.pseudo);
    } catch (error) {
      if (!current(request)) return;
      paint('<h3>Profil indisponible</h3><p class="auth-message" data-auth-message role="alert"></p><button class="btn btn-surface" type="button" data-retry-profile>Réessayer</button>');
      feedback(error.message || 'Le profil n’a pas pu être lu. Réessaie dans un instant.', 'error');
    }
  }

  panel.addEventListener('input', event => {
    if (!event.target.matches('#auth-pseudo[aria-invalid="true"]')) return;
    event.target.removeAttribute('aria-invalid');
    feedback('');
  }, { signal });
  panel.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    const input = form.elements.pseudo;
    if (!input || input.readOnly || service.getState().status !== 'authenticated') return;
    const pseudo = input.value.trim();
    const problem = validatePseudo(pseudo);
    if (problem) {
      input.setAttribute('aria-invalid', 'true');
      feedback(problem, 'error');
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    const request = sequence;
    const submit = event.submitter || form.querySelector('[type="submit"]');
    form.setAttribute('aria-busy', 'true');
    submit.disabled = true;
    input.readOnly = true;
    feedback('Enregistrement du pseudo…');
    try {
      const updated = await service.updateProfile(pseudo);
      if (current(request)) {
        showPseudo(updated.pseudo);
        feedback('Ton pseudo a été enregistré.', 'success');
      }
    } catch (error) {
      if (current(request)) feedback(error.message || 'Le pseudo n’a pas pu être enregistré. Réessaie dans un instant.', 'error');
    } finally {
      if (current(request)) {
        form.removeAttribute('aria-busy');
        submit.disabled = false;
        input.readOnly = false;
      }
    }
  }, { signal });
  panel.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.matches('[data-retry-profile]')) {
      const { status, user } = service.getState();
      if (status === 'authenticated' && user) loadProfile(user);
    } else if (button.matches('[data-retry-session]')) {
      button.disabled = true;
      try { await service.retry(); }
      catch { /* Auth publishes the result and its error. */ }
      finally { button.disabled = false; }
    } else if (button.matches('[data-sign-out]')) {
      signingOut = true;
      try { await service.signOut(); }
      catch { /* Auth publishes the result and its error. */ }
      finally { signingOut = false; }
    }
  }, { signal });

  return service.subscribe(state => {
    const next = JSON.stringify([state.status, state.user?.id, service.getIdentityVersion(), state.error]);
    if (signal.aborted || identity === next) return;
    identity = next;
    if (state.status === 'authenticated' && state.user) { loadProfile(state.user); return; }
    ++sequence;
    if (state.status === 'loading') paint(signingOut ? '<p role="status">Déconnexion en cours…</p>' : profileChecking);
    else if (state.status === 'anonymous') {
      paint(`<h3>Connexion nécessaire</h3><p>Connecte-toi pour consulter ton compte et modifier ton pseudo.</p>${connectLink}`);
    } else if (state.status === 'unavailable') {
      paint(`<h3>Connexion indisponible</h3><p class="auth-message" data-auth-message role="alert"></p>${connectLink}`);
      feedback(state.error, 'error');
    } else {
      const title = state.status === 'offline' ? 'Session à vérifier' : 'Impossible de vérifier la session';
      paint(`<h3>${title}</h3><p class="auth-message" data-auth-message role="alert"></p><div class="profile-actions"><button class="btn btn-surface" type="button" data-retry-session>Vérifier la session</button>${connectLink}</div>`);
      feedback(signingOut && state.status === 'error' ? `La déconnexion a échoué. ${state.error}` : state.error, 'error');
    }
  });
}
