import { emptyCatalogue, emptyParcours, exams, loadParcoursCatalogue, otherUnits, parcoursCompletion,
  summariseParcours, uc1Labels, validateParcours } from './parcours-model.js';
import { createParcoursSession, parcoursConflict } from './parcours-service.js';
import { getSupabaseClient } from './supabase-client.js';
import { subscribePrivacy } from './privacy-events.js';

const formatDay = day => day.split('-').reverse().join('/');
const count = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;
const editing = 'Modifications non enregistrées.';
const pending = 'Enregistré sur cet appareil. Synchronisation en attente.';
const conflict = 'Une autre version a été enregistrée. Utilise la version synchronisée ou confirme le remplacement par tes choix.';
const deviceConflict = 'Un autre onglet a modifié le brouillon. Reprends son brouillon pour continuer sur cet appareil.';
const syncFailure = 'La synchronisation a échoué. Tes choix restent sur cet appareil. Réessaie avec le bouton Enregistrer.';

function option(value, text) {
  return new Option(text, value);
}

function choice(name, value, label, description) {
  const wrapper = document.createElement('label');
  wrapper.className = 'parcours-choice';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = name;
  input.value = value;
  const text = document.createElement('span');
  text.textContent = label;
  if (description) {
    const detail = document.createElement('small');
    detail.textContent = description;
    text.append(detail);
  }
  wrapper.append(input, text);
  return wrapper;
}

export function initParcours(root, auth, signal) {
  const panel = root.querySelector('#mon-parcours');
  if (!panel) return;
  const open = root.querySelector('#parcours-open');
  const badge = root.querySelector('#parcours-state');
  const title = panel.querySelector('h2');
  const find = suffix => panel.querySelector(`[data-parcours-${suffix}]`);
  const form = find('form');
  const fields = form.querySelector('fieldset');
  const save = find('save'), recover = find('recover'), overwrite = find('overwrite');
  const examSelect = form.elements['parcours-exam'];
  const sessionSelect = form.elements['parcours-session'];
  const dateInput = form.elements['parcours-date'];
  const dateError = panel.querySelector('#parcours-date-error');
  const sessionHelp = panel.querySelector('#parcours-session-help');
  find('units').append(...otherUnits.map(unit => choice('units', unit.id, unit.label)));
  find('exams').append(...exams.map(unit => choice('exams', unit.id, unit.label)));

  let catalogue = emptyCatalogue, catalogueFailed = false;
  let job, doc, value = emptyParcours(), examId = '', message = '', kind = '';
  let busy = false, access = '', dirty = false, localIssue = '', editingQueue = Promise.resolve();
  let suspended = false;
  let loadCatalogue;

  function showCatalogueChoices() {
    const entries = catalogue.ucare.filter(entry => entry.active || value.ucare.includes(entry.id));
    const missing = value.ucare.filter(key => !entries.some(entry => entry.id === key));
    const choices = entries.map(entry => choice('ucare', entry.id, entry.label, entry.active
      ? [entry.group, entry.description].filter(Boolean).join(' · ') : 'Retirée du catalogue'));
    choices.push(...missing.map(key => choice('ucare', key, `Choix indisponible (${key})`)));
    find('ucare').replaceChildren(...choices);
    find('ucare-message').textContent = catalogueFailed ? 'Le catalogue des UCARE est indisponible pour le moment.'
      : !catalogue.ucare.some(entry => entry.active) ? 'La liste officielle des UCARE est en attente de validation.'
        : catalogue.ucareMinimum ? `Sélection attendue : au moins ${count(catalogue.ucareMinimum, 'UCARE', 'UCARE')}.` : '';
  }

  function showDates() {
    if (!value.exams.includes(examId)) examId = value.exams[0] || '';
    find('dates').hidden = !examId;
    find('no-exam').hidden = Boolean(examId);
    examSelect.replaceChildren(...exams.filter(exam => value.exams.includes(exam.id)).map(exam => option(exam.id, exam.label)));
    examSelect.value = examId;
    const assignment = value.assignments[examId];
    const official = catalogue.sessions.filter(entry => entry.active && entry.examId === examId);
    const options = [option('', 'À confirmer'), ...official.map(entry => option(entry.id, entry.label.length > 24 ? `Session du ${formatDay(entry.date)}` : entry.label))];
    if (assignment?.sessionId && !official.some(entry => entry.id === assignment.sessionId)) {
      options.push(option(assignment.sessionId, 'Session précédemment choisie (indisponible)'));
    }
    sessionSelect.replaceChildren(...options);
    sessionSelect.value = assignment?.sessionId || '';
    dateInput.value = assignment?.personalDate || '';
    dateInput.removeAttribute('aria-invalid');
    dateError.hidden = true;
    showSessionHelp(official);
  }

  function showSessionHelp(official = catalogue.sessions.filter(entry => entry.active && entry.examId === examId)) {
    const selected = official.find(entry => entry.id === sessionSelect.value);
    sessionHelp.textContent = selected ? `${selected.label} · ${formatDay(selected.date)}`
      : catalogueFailed ? 'Impossible de charger les sessions officielles.'
      : official.length ? '' : 'Aucune session officielle disponible pour cette épreuve.';
  }

  function showValues() {
    for (const input of fields.querySelectorAll('input[type="radio"]')) input.checked = input.value === value.uc1;
    for (const input of fields.querySelectorAll('input[type="checkbox"]')) input.checked = value[input.name].includes(input.value);
  }

  function paint() {
    const summary = summariseParcours(value, catalogue);
    find('access').textContent = access;
    badge.textContent = parcoursCompletion(doc?.remote?.preferences, catalogue);
    find('exempt').hidden = value.uc1 !== 'exempt';
    find('uc1-warning').hidden = !summary.uc1Conflict;
    find('summary-uc1').textContent = uc1Labels[value.uc1];
    find('summary-ucare').textContent = summary.ucare.length ? `${summary.ucare.length} UCARE · ${summary.ucare.join(', ')}` : 'Aucune UCARE sélectionnée';
    find('summary-exams').textContent = summary.selectedExams.length
      ? `${count(summary.selectedExams.length, 'épreuve', 'épreuves')} · ${summary.selectedExams.map(exam => exam.label).join(', ')}` : 'Aucune épreuve sélectionnée';
    const dated = summary.dates.flatMap(item => {
      const details = [];
      if (item.official) details.push(`session officielle le ${formatDay(item.official.date)}`);
      if (item.personal) details.push(`date personnelle indicative le ${formatDay(item.personal)}`);
      if (item.unavailable) details.push('session choisie indisponible');
      return details.length ? [`${item.label} · ${details.join(', ')}`] : [];
    });
    if (summary.toConfirm || !summary.dates.length) dated.push(summary.dates.length
      ? `${summary.toConfirm} à confirmer` : 'Sessions à confirmer');
    find('summary-dates').textContent = dated.join(' · ');
    find('preview-state').textContent = dirty || doc?.draft ? doc?.draft?.requested && !dirty ? pending : editing
      : doc?.remote ? 'Derniers choix synchronisés.' : 'Récapitulatif de tes choix actuels.';
    find('message').textContent = localIssue || message || (parcoursConflict(doc) ? conflict : '');
    find('message').dataset.kind = localIssue || (!message && parcoursConflict(doc)) ? 'error' : kind;
    if (form.hidden) return;
    fields.disabled = busy;
    form.setAttribute('aria-busy', String(busy));
    save.disabled = busy || (!dirty && !doc?.draft) || Boolean(localIssue) || parcoursConflict(doc);
    recover.disabled = busy;
    recover.hidden = !parcoursConflict(doc) && localIssue !== deviceConflict;
    recover.textContent = localIssue === deviceConflict ? 'Reprendre le brouillon de l’autre onglet' : 'Utiliser la version synchronisée';
    overwrite.disabled = busy;
    overwrite.hidden = !parcoursConflict(doc) || Boolean(localIssue);
  }

  function showDocument(next) {
    doc = next;
    value = structuredClone(doc?.draft?.value ?? doc?.remote?.preferences ?? emptyParcours());
    showCatalogueChoices();
    showValues();
    showDates();
    paint();
  }

  function ensureCatalogue() {
    if (!loadCatalogue || catalogueFailed) {
      catalogueFailed = false;
      loadCatalogue = loadParcoursCatalogue(signal).then(result => { catalogue = result; })
        .catch(() => { catalogueFailed = true; })
        .then(() => {
          if (signal.aborted) return;
          showCatalogueChoices();
          showValues();
          showDates();
          paint();
        });
    }
  }

  function reveal(expanded, focus = true) {
    panel.hidden = !expanded;
    open.setAttribute('aria-expanded', String(expanded));
    if (expanded) ensureCatalogue();
    if (!focus) return;
    const target = expanded ? title : open;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: expanded ? 'start' : 'nearest' });
  }

  async function runSync(current, rebase = false, automatic = false) {
    if (job !== current || busy || !doc) return;
    busy = true;
    message = ''; kind = '';
    paint();
    try {
      await editingQueue;
      if (job !== current || localIssue || dirty) return;
      if (!automatic) {
        const requested = await current.service.request(doc.draft?.token ?? null, rebase);
        if (job !== current) return;
        doc = requested;
      }
      if (!doc.draft?.requested) return;
      if (navigator.onLine === false || (automatic && auth.getState().status !== 'authenticated')) {
        message = pending; return;
      }
      const result = await current.service.sync(doc);
      if (job !== current) return;
      showDocument(result.doc);
      if (result.status === 'saved' && !doc.draft) { message = 'Ton parcours a été enregistré et synchronisé.'; kind = 'success'; }
      if (result.status === 'conflict') { message = conflict; kind = 'error'; }
    } catch (error) {
      if (job !== current) return;
      if (error.code === 'local_conflict') localIssue = deviceConflict;
      else if (error.code === 'local_erased') localIssue = 'Le cache de cet appareil a été retiré.';
      else { message = doc?.draft?.requested ? syncFailure : 'Impossible de préparer la sauvegarde sur cet appareil.'; kind = 'error'; }
    } finally {
      if (job === current) { busy = false; paint(); }
    }
  }

  async function load(current) {
    access = 'Chargement de ton parcours…'; paint();
    try {
      const configuration = await getSupabaseClient();
      if (job !== current || signal.aborted) return;
      const active = () => job === current && !signal.aborted && auth.getIdentityVersion() === current.version &&
        auth.getState().user?.id === current.userId && ['offline', 'authenticated'].includes(auth.getState().status);
      current.service = createParcoursSession(configuration, auth, current.userId, { signal: current.controller.signal, active });
      const cached = await current.service.read();
      if (!active()) return;
      access = '';
      busy = true;
      form.hidden = false;
      showDocument(cached);
      if (auth.getState().status === 'authenticated' && !cached.draft?.requested) {
        try {
          const latest = await current.service.refresh();
          if (active()) showDocument(latest);
        } catch {
          if (active()) {
            message = 'Lecture du serveur indisponible. Tu peux préparer tes choix sur cet appareil.';
            kind = 'error';
          }
        }
      } else if (auth.getState().status === 'offline') {
        message = 'Hors connexion. Les choix de cet appareil restent disponibles.';
      }
      if (!active()) return;
      busy = false; paint();
      if (doc.draft?.requested && !parcoursConflict(doc)) void runSync(current, false, true);
    } catch (error) {
      if (job !== current) return;
      access = error.code === 'local_erased' ? 'Le cache du parcours a été effacé sur cet appareil.'
        : 'Impossible d’ouvrir le cache du parcours. Recharge la page pour réessayer.';
      form.hidden = true;
      busy = false; paint();
    }
  }

  function clearJob(closePanel) {
    const previous = job;
    job = null;
    previous?.controller.abort();
    if (previous?.service) void previous.service.close().catch(() => {});
    if (closePanel && !panel.hidden) reveal(false, panel.contains(document.activeElement));
    message = ''; kind = ''; localIssue = ''; dirty = false; busy = false;
    editingQueue = Promise.resolve();
    access = '';
    form.hidden = true;
    form.querySelector('details').open = false;
    examId = '';
    showDocument(null);
  }

  function stateChanged(state) {
    if (signal.aborted) return;
    const version = auth.getIdentityVersion();
    const userId = ['authenticated', 'offline'].includes(state.status) && !suspended ? state.user?.id : null;
    if (job && userId && userId === job.userId && version === job.version) return;
    clearJob(Boolean(job));
    if (userId) {
      find('connect').hidden = true;
      job = { userId, version, controller: new AbortController() };
      ensureCatalogue();
      void load(job);
      return;
    }
    access = state.status === 'loading' ? 'Vérification de la session…'
      : state.status === 'anonymous' ? 'Connecte-toi pour configurer ton parcours.'
        : 'Le parcours est disponible avec une session de compte vérifiée.';
    find('connect').hidden = state.status !== 'anonymous';
    paint();
  }

  function persist(current, next, base) {
    dirty = true;
    paint();
    editingQueue = editingQueue.then(async () => {
      if (job !== current || localIssue) return;
      try {
        const updated = await current.service.edit(doc.draft?.token ?? null, base, next);
        if (job !== current) return;
        doc = updated;
        if (value === next) dirty = false;
      } catch (error) {
        if (job !== current) return;
        if (error.code === 'local_conflict') localIssue = deviceConflict;
        else { message = 'Impossible de conserver ce brouillon sur cet appareil. Garde ce panneau ouvert pour réessayer.'; kind = 'error'; }
      }
      paint();
    });
  }

  open.disabled = false;
  open.addEventListener('click', () => reveal(panel.hidden), { signal });
  find('close').addEventListener('click', () => reveal(false), { signal });
  fields.addEventListener('change', event => {
    if (!job || !doc || busy) return;
    const input = event.target;
    if (input === examSelect) { examId = input.value; showDates(); return; }
    const next = structuredClone(value);
    if (input.name === 'parcours-uc1') next.uc1 = input.value;
    else if (input === sessionSelect || input === dateInput) {
      const assignment = next.assignments[examId] ?? { sessionId: null, personalDate: null };
      if (input === dateInput && !dateInput.validity.valid) {
        dateInput.setAttribute('aria-invalid', 'true'); dateError.hidden = false; return;
      }
      dateInput.removeAttribute('aria-invalid'); dateError.hidden = true;
      if (input === sessionSelect) showSessionHelp();
      const key = input === sessionSelect ? 'sessionId' : 'personalDate';
      next.assignments[examId] = { ...assignment, [key]: input.value || null };
    } else if (Object.hasOwn({ units: true, exams: true, ucare: true }, input.name)) {
      const previous = next[input.name];
      next[input.name] = input.checked ? [...previous, input.value] : previous.filter(key => key !== input.value);
    } else return;
    try {
      value = validateParcours(next);
      message = ''; kind = '';
      if (input.name === 'exams') showDates();
      const base = doc.draft ? doc.draft.base : doc.observed ? doc.remote?.revision ?? 0 : null;
      persist(job, value, base);
    } catch {
      showValues(); message = 'Les choix dépassent la capacité du formulaire.'; kind = 'error'; paint();
    }
  }, { signal });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const current = job;
    if (!current || busy) return;
    await editingQueue;
    if (job !== current) return;
    if (dirty && !localIssue) {
      persist(current, value, doc.draft ? doc.draft.base : doc.observed ? doc.remote?.revision ?? 0 : null);
      await editingQueue;
    }
    if (job === current) void runSync(current);
  }, { signal });
  overwrite.addEventListener('click', () => { if (job) void runSync(job, true); }, { signal });
  recover.addEventListener('click', async () => {
    const current = job;
    if (!current || busy) return;
    busy = true; paint();
    try {
      await editingQueue;
      if (job !== current) return;
      const otherTab = localIssue === deviceConflict;
      const next = otherTab ? await current.service.read() : await current.service.reset(doc.draft?.token ?? null);
      if (job !== current) return;
      localIssue = ''; dirty = false;
      showDocument(next);
      message = otherTab ? 'Le brouillon de cet appareil a été rechargé.' : 'Les dernières valeurs synchronisées ont été rétablies.'; kind = '';
    } catch {
      if (job === current) { message = 'Impossible de reprendre le parcours sur cet appareil.'; kind = 'error'; }
    } finally {
      if (job === current) { busy = false; paint(); if (!panel.hidden) title.focus({ preventScroll: true }); }
    }
  }, { signal });
  window.addEventListener('online', async () => {
    const current = job;
    if (!current?.service || !doc?.draft?.requested || parcoursConflict(doc)) return;
    if (auth.getState().status === 'offline') {
      try { await auth.retry(); } catch { return; }
    }
    if (job === current) void runSync(current, false, true);
  }, { signal });
  const unsubscribe = auth.subscribe(stateChanged);
  const unPrivacy = subscribePrivacy(phase => {
    suspended = phase === 'suspend';
    stateChanged(auth.getState());
  });
  signal.addEventListener('abort', () => { clearJob(true); unsubscribe(); unPrivacy(); }, { once: true });
}
