import { getAuthService } from './auth-service.js';
import { validateCredentials, validatePassword, validatePseudo } from './auth-validation.js';
import { renderBreadcrumbs } from './breadcrumbs.js';
import { initExportUI } from './export-ui.js';
import { initErasureUI } from './erasure-ui.js';

const controllers = new WeakMap();
const restoreHandlers = new WeakSet();
const descriptions = {
  'auth-login': ['Connexion', 'Retrouve ton espace personnel avec ton compte invité.'],
  'auth-reset': ['Mot de passe oublié', 'Reçois un lien par e-mail pour choisir un nouveau mot de passe.'],
  'auth-callback': ['Activation et mot de passe', 'Finalise ton invitation ou réinitialise ton mot de passe.'],
  profile: ['Mon profil', 'Les informations de ton compte et ton pseudo.'],
};
const emailField = `<div class="auth-field"><label for="auth-email">Adresse e-mail</label><input id="auth-email" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="254" required></div>`;
const passwordFields = `<div class="auth-field"><label for="auth-password">Nouveau mot de passe</label><input id="auth-password" name="password" type="password" autocomplete="new-password" aria-describedby="auth-password-help" required><small id="auth-password-help">De 12 à 128 caractères. Choisis un mot de passe unique pour ce compte.</small></div><div class="auth-field"><label for="auth-confirmation">Confirmer le mot de passe</label><input id="auth-confirmation" name="confirmation" type="password" autocomplete="new-password" required></div>`;

/** Only fixed interface markup is rendered as HTML; account data uses textContent. */
export async function initAuthPage(root = document.querySelector('#app-main')) {
  if (!root) return;
  controllers.get(root)?.();
  const page = document.body.dataset.page;
  if (!descriptions[page]) return;
  const abort = new AbortController();
  let unsubscribe = () => {};
  let disposed = false;
  let disposeExport = () => {};
  let disposeErasure = () => {};
  const dispose = () => {
    disposed = true;
    abort.abort();
    unsubscribe();
    disposeExport();
    disposeErasure();
    link = null;
    for (const input of root.querySelectorAll('input[type="password"]')) input.value = '';
    if (page === 'profile' || page === 'auth-callback') root.textContent = 'Vérification de la session…';
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
  root.innerHTML = `<section class="page-top wrap auth-top">${renderBreadcrumbs(page)}<div class="page-eyebrow">TON ESPACE PERSONNEL</div><h1></h1><p></p></section><div class="wrap auth-layout"><section class="auth-panel" aria-label="Compte personnel"><p class="auth-message" role="status">Chargement du compte…</p></section><aside class="auth-aside"><h2>Un compte sur invitation</h2><p>Ton compte est créé à partir d’une invitation envoyée par l’administrateur. Il n’y a pas d’inscription libre.</p><p>Les cours et les outils publics restent disponibles sans connexion.</p><p><a href="mes-cours.html">Parcourir mes cours</a></p><p class="auth-help">En visiteur, l’historique des exercices hebdomadaires reste sur cet appareil. Lorsque l’espace personnel est activé, les réponses du compte alimentent son tableau de bord et se synchronisent ; celles en attente ne sont pas encore confirmées sur les autres appareils.</p></aside></div>`;
  root.querySelector('h1').textContent = descriptions[page][0];
  root.querySelector('.auth-top > p').textContent = descriptions[page][1];
  const panel = root.querySelector('.auth-panel');
  let service;
  try { service = await getAuthService(); }
  catch { if (!disposed) panel.innerHTML = '<h2>Connexion indisponible</h2><p>Le service de compte ne peut pas être chargé. Recharge la page pour réessayer.</p>'; return; }
  if (disposed) return;
  if (page === 'profile') {
    const exportRoot = document.createElement('div'); root.append(exportRoot);
    const cleanup = await initExportUI(exportRoot, { auth: service });
    if (disposed) cleanup(); else disposeExport = cleanup;
    const erasureRoot = document.createElement('div'); root.append(erasureRoot);
    const eraseCleanup = await initErasureUI(erasureRoot, { auth: service });
    if (disposed) eraseCleanup(); else disposeErasure = eraseCleanup;
  }

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
  function signInPrompt() {
    panel.innerHTML = '<h2>Connexion nécessaire</h2><p>Connecte-toi pour consulter ton profil personnel.</p><a class="btn btn-primary" href="connexion.html">Connexion</a>';
  }
  const safeError = error => error?.message || 'Le service est momentanément indisponible. Réessaie dans un instant.';
  const listen = (node, event, callback) => node.addEventListener(event, callback, { signal: abort.signal });

  if (page === 'auth-login') {
    panel.innerHTML = `<h2>Se connecter</h2>${messageMarkup()}<form class="auth-form">${emailField}<div class="auth-field"><label for="auth-password">Mot de passe</label><input id="auth-password" name="password" type="password" autocomplete="current-password" required></div><button class="btn btn-primary" type="submit">Se connecter</button></form><div class="auth-links"><a href="mot-de-passe-oublie.html">Mot de passe oublié</a><a href="profil.html" data-profile-link hidden>Mon profil</a></div>`;
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

  if (page === 'auth-reset') {
    panel.innerHTML = `<h2>Recevoir un lien</h2><p>Indique l’adresse utilisée pour ton invitation.</p>${messageMarkup()}<form class="auth-form">${emailField}<button class="btn btn-primary" type="submit">Envoyer le lien de réinitialisation</button></form><div class="auth-links"><a href="connexion.html">Retour à la connexion</a></div>`;
    const form = panel.querySelector('form');
    let pending = false;
    unsubscribe = service.subscribe(state => {
      if (disposed) return;
      busy(form, pending || state.status === 'loading' || state.status === 'unavailable');
      if (state.status === 'unavailable') message(state.error || 'La récupération de mot de passe n’est pas encore configurée.', 'error');
      else if (state.status === 'loading') message('Vérification du service…');
      else if (!pending) message('');
    });
    listen(form, 'submit', async event => {
      event.preventDefault();
      if (pending) return;
      pending = true; busy(form, true); message('Demande en cours…');
      try {
        await service.requestPasswordReset(form.elements.email.value.trim());
        if (!disposed) message('Si cette adresse correspond à un compte, un e-mail contenant un lien de réinitialisation sera envoyé. Consulte aussi les courriers indésirables.', 'success', true);
      } catch (error) { if (!disposed) message(safeError(error), 'error', true); }
      finally { pending = false; if (!disposed) busy(form, false); }
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
      panel.innerHTML = '<h2>Lien invalide ou expiré</h2><p role="alert">Ce lien ne peut pas être utilisé. Il peut avoir expiré ou avoir déjà été ouvert.</p><p>Pour une invitation, demande un nouveau lien à l’administrateur. Pour un mot de passe oublié, fais une nouvelle demande.</p><div class="auth-links"><a href="mot-de-passe-oublie.html">Demander un nouveau lien</a><a href="connexion.html">Connexion</a></div>';
    }
    if (!link) { invalidLink(); return; }
    panel.innerHTML = `<h2>${linkType === 'invite' ? 'Activer ton compte' : 'Réinitialiser ton mot de passe'}</h2>${messageMarkup()}<p>Pour vérifier le lien reçu par e-mail, utilise le bouton ci-dessous. Tu pourras ensuite choisir ton mot de passe.</p><button class="btn btn-primary" type="button" data-continue>${linkType === 'invite' ? 'Continuer l’activation' : 'Continuer la réinitialisation'}</button>`;
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
      panel.innerHTML = `<h2>Choisir ton mot de passe</h2>${messageMarkup()}<form class="auth-form">${passwordFields}<button class="btn btn-primary" type="submit">Définir le mot de passe</button></form>`;
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
          panel.innerHTML = `<h2>${linkType === 'invite' ? 'Ton compte est activé' : 'Ton mot de passe est modifié'}</h2><p role="status">Ton nouveau mot de passe est enregistré. Tu peux maintenant consulter ton profil.</p><a class="btn btn-primary" href="profil.html">Mon profil</a>`;
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

  if (page === 'profile') {
    let activeUserId = null;
    let requestId = 0;
    let pending = false;
    async function loadProfile(user) {
      const request = ++requestId;
      panel.innerHTML = '<p class="auth-message" role="status">Chargement du profil…</p>';
      try {
        const profile = await service.getProfile();
        if (disposed || request !== requestId || service.getState().status !== 'authenticated' || service.getState().user?.id !== user.id) return;
        panel.innerHTML = `<h2>Les informations du compte</h2>${messageMarkup()}<dl class="auth-details"><div><dt>Adresse e-mail</dt><dd data-email></dd></div><div><dt>Compte créé le</dt><dd data-created></dd></div></dl><form class="auth-form"><div class="auth-field"><label for="auth-pseudo">Pseudo (facultatif)</label><input id="auth-pseudo" name="pseudo" type="text" autocomplete="nickname" aria-describedby="auth-pseudo-help"><small id="auth-pseudo-help">De 2 à 40 caractères, ou laisse ce champ vide. Ne saisis pas d’information sensible.</small></div><button class="btn btn-primary" type="submit">Enregistrer le pseudo</button></form><hr class="auth-divider"><div class="auth-account-actions"><a href="mot-de-passe-oublie.html">Changer mon mot de passe</a><button class="btn btn-outline" type="button" data-sign-out>Déconnexion</button></div>`;
        panel.querySelector('[data-email]').textContent = user.email || 'Adresse indisponible';
        const created = new Date(user.created_at);
        panel.querySelector('[data-created]').textContent = user.created_at && Number.isFinite(created.getTime()) ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(created) : 'Date indisponible';
        const form = panel.querySelector('form');
        form.elements.pseudo.value = profile.pseudo || '';
        listen(form, 'submit', async event => {
          event.preventDefault();
          if (pending) return;
          clearValidation(form);
          const pseudo = form.elements.pseudo.value.trim();
          const error = validatePseudo(pseudo);
          if (error) { invalid(form, error, ['pseudo']); return; }
          pending = true; busy(form, true); message('Enregistrement du pseudo…');
          try {
            const updated = await service.updateProfile(pseudo);
            if (!disposed && request === requestId && service.getState().user?.id === user.id) {
              form.elements.pseudo.value = updated.pseudo || '';
              message('Ton pseudo a été enregistré.', 'success', true);
            }
          } catch (error) { if (!disposed && request === requestId) message(safeError(error), 'error', true); }
          finally { pending = false; if (!disposed) busy(form, false); }
        });
        listen(panel.querySelector('[data-sign-out]'), 'click', async event => {
          const button = event.currentTarget;
          button.disabled = true;
          try { await service.signOut(); }
          catch (error) { if (!disposed) { button.disabled = false; message(safeError(error), 'error', true); } }
        });
      } catch (error) {
        if (disposed || request !== requestId) return;
        panel.innerHTML = `<h2>Profil indisponible</h2>${messageMarkup()}<p>Le profil n’a pas pu être lu. Réessaie pour vérifier sa disponibilité.</p><button type="button" class="btn btn-outline" data-retry>Réessayer</button>`;
        message(safeError(error), 'error');
        listen(panel.querySelector('[data-retry]'), 'click', () => {
          if (service.getState().status === 'authenticated' && service.getState().user?.id === user.id) loadProfile(service.getState().user);
          else signInPrompt();
        });
      }
    }
    unsubscribe = service.subscribe(state => {
      if (disposed) return;
      if (state.status === 'authenticated' && state.user) {
        if (activeUserId !== state.user.id) { activeUserId = state.user.id; loadProfile(state.user); }
        return;
      }
      activeUserId = null;
      ++requestId;
      if (state.status === 'loading') panel.innerHTML = '<p class="auth-message" role="status">Vérification de la session…</p>';
      else if (state.status === 'unavailable') {
        panel.innerHTML = `<h2>Connexion indisponible</h2>${messageMarkup()}<p>Le compte personnel doit être configuré pour cet environnement.</p><a href="connexion.html" class="btn btn-outline">Connexion</a>`;
        message(state.error || 'La connexion n’est pas encore configurée.', 'error');
      } else signInPrompt();
    });
  }
}
