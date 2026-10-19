import { units } from './content.js';
import { renderBreadcrumbs } from './breadcrumbs.js';
import { loadCalendar, parseDate, dateKey, todayKey, eventTypes } from './calendar-data.js';

const clean = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const fullDayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const controllers = new WeakMap();
const unitFor = event => units.find(unit => unit.id === event.unit);
const rangeLabel = event => event.start === event.end
  ? dayFormat.format(parseDate(event.start))
  : `Du ${dayFormat.format(parseDate(event.start))} au ${dayFormat.format(parseDate(event.end))}`;

function introduction() {
  return `<section class="page-top wrap calendar-intro">${renderBreadcrumbs('calendar')}<div class="page-eyebrow">LE FIL DE TA FORMATION</div><h1>Une année pour apprendre.</h1><p>Retrouve tes temps de cours, de stage et de pause, puis garde les périodes d’examen en vue. Chaque étape a sa place.</p></section>`;
}

export async function initCalendar(root) {
  root.innerHTML = `${introduction()}<section class="wrap calendar-notice" role="status"><strong>Le calendrier prend place…</strong><p>Chargement des événements de formation.</p></section>`;
  const data = await loadCalendar();
  renderCalendar(root, data);
  return data;
}

export function renderCalendar(root, data) {
  controllers.get(root)?.abort();
  const controller = new AbortController();
  controllers.set(root, controller);
  const { signal } = controller;
  const on = (element, name, handler) => element.addEventListener(name, handler, { signal });
  const events = data.events || [];
  const warnings = data.warnings || [];
  const query = new URLSearchParams(location.search);
  const requestedEvent = events.find(event => event.id === query.get('event'));
  const requestedDate = parseDate(query.get('date')) || parseDate(`${query.get('month')}-01`) || (requestedEvent && parseDate(requestedEvent.start));
  const current = requestedDate || parseDate(todayKey());
  current.setDate(1);
  let displayed = current;

  const notice = data.error
    ? `<div class="calendar-notice calendar-notice-warning" role="alert"><strong>Calendrier indisponible</strong><p>${clean(data.error)}</p><button class="btn btn-outline" type="button" data-calendar-retry>Réessayer</button></div>`
    : !events.length
      ? `<div class="calendar-notice"><strong>${warnings.length ? 'Aucun événement ne peut être affiché pour le moment.' : 'Ton calendrier attend les dates de formation.'}</strong><p>${warnings.length ? 'Les informations disponibles doivent être complétées ou corrigées.' : 'Aucune date de cours, de stage, de vacances ou d’examen n’est encore renseignée. Tu peux déjà parcourir les mois.'}</p></div>`
      : '';
  root.innerHTML = `${introduction()}<section class="wrap calendar-section" aria-label="Calendrier de formation">${notice}${warnings.length ? `<details class="calendar-notice calendar-notice-warning"><summary>Certaines informations sont incomplètes (${warnings.length})</summary><ul>${warnings.map(warning => `<li>${clean(warning)}</li>`).join('')}</ul></details>` : ''}<div class="calendar-board"><div class="calendar-toolbar"><div><span class="eyebrow">TON EMPLOI DU TEMPS</span><h2 id="calendar-month-title" aria-live="polite" aria-atomic="true"></h2></div><div class="calendar-controls"><div class="calendar-month-nav" aria-label="Navigation entre les mois"><button class="btn btn-outline calendar-arrow" type="button" data-month-step="-1" aria-label="Mois précédent">←</button><button class="btn btn-outline" type="button" data-calendar-today>Aujourd’hui</button><button class="btn btn-outline calendar-arrow" type="button" data-month-step="1" aria-label="Mois suivant">→</button></div><label class="calendar-month-choice">Aller au mois<input type="month" id="calendar-month-input" min="0001-01" max="9999-12" /></label></div></div><ul class="calendar-legend" aria-label="Catégories d’événements">${Object.entries(eventTypes).map(([type, label]) => `<li class="calendar-category calendar-type-${type}"><span aria-hidden="true"></span>${label}</li>`).join('')}</ul><div class="calendar-grid-region"><table class="calendar-grid" aria-labelledby="calendar-month-title"><thead><tr>${['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(day => `<th scope="col"><abbr title="${day}">${day.slice(0, 3)}.</abbr></th>`).join('')}</tr></thead><tbody id="calendar-days"></tbody></table></div><p class="calendar-grid-caption">Choisis un événement pour consulter son détail. Les périodes comprennent leur premier et leur dernier jour.</p></div><section class="calendar-agenda" aria-labelledby="calendar-agenda-title"><div class="calendar-agenda-heading"><div><span class="eyebrow">LES DATES À RETENIR</span><h2 id="calendar-agenda-title" tabindex="-1">L’agenda du mois</h2></div><span id="calendar-event-count" class="section-count"></span></div><div id="calendar-agenda-content"></div></section></section><dialog class="calendar-dialog" aria-labelledby="calendar-detail-title"><div id="calendar-detail-content"></div><form method="dialog" class="calendar-dialog-actions"><button class="btn btn-primary" type="submit">Fermer le détail</button></form></dialog>`;

  const monthTitle = root.querySelector('#calendar-month-title');
  const monthInput = root.querySelector('#calendar-month-input');
  const days = root.querySelector('#calendar-days');
  const agenda = root.querySelector('#calendar-agenda-content');
  const dialog = root.querySelector('.calendar-dialog');

  function eventButton(event) {
    const unit = unitFor(event);
    return `<button type="button" class="calendar-event calendar-type-${event.type}" data-calendar-event="${clean(event.id)}" aria-label="${clean(`${eventTypes[event.type]}${event.example ? ' · Exemple' : ''} : ${event.title}${unit ? `, ${unit.code}` : ''}. ${rangeLabel(event)}. Consulter le détail.`)}"><span class="calendar-event-type">${eventTypes[event.type]}${event.example ? ' · Exemple' : ''}</span><span class="calendar-event-title">${clean(event.title)}</span>${unit ? `<span class="calendar-event-unit">${clean(unit.code)}</span>` : ''}</button>`;
  }

  function refresh() {
    const year = displayed.getFullYear();
    const month = displayed.getMonth();
    const first = dateKey(displayed);
    const lastDate = new Date(displayed);
    lastDate.setMonth(month + 1, 0);
    const last = dateKey(lastDate);
    const inMonth = events.filter(event => event.start <= last && event.end >= first);
    monthTitle.textContent = monthFormat.format(displayed);
    monthInput.value = first.slice(0, 7);
    root.querySelector('[data-month-step="-1"]').disabled = year === 1 && month === 0;
    root.querySelector('[data-month-step="1"]').disabled = year === 9999 && month === 11;
    const start = new Date(displayed);
    start.setDate(1 - ((displayed.getDay() + 6) % 7));
    const numberOfDays = Math.ceil((((displayed.getDay() + 6) % 7) + lastDate.getDate()) / 7) * 7;
    let cells = '';
    for (let offset = 0; offset < numberOfDays; offset++) {
      const day = new Date(start);
      day.setDate(start.getDate() + offset);
      const key = dateKey(day);
      const outside = day.getMonth() !== month;
      const today = key === todayKey();
      const dayEvents = outside ? [] : inMonth.filter(event => event.start <= key && event.end >= key);
      if (offset % 7 === 0) cells += '<tr>';
      cells += `<td class="${outside ? 'calendar-outside ' : ''}${today ? 'calendar-today ' : ''}${offset % 7 > 4 ? 'calendar-weekend' : ''}"><div class="calendar-day"><time datetime="${key}" class="calendar-day-number" aria-label="${clean(fullDayFormat.format(day))}${today ? ', aujourd’hui' : ''}"${today ? ' aria-current="date"' : ''}>${day.getDate()}</time>${today && !outside ? '<span class="calendar-today-label">Aujourd’hui</span>' : ''}${dayEvents.length ? `<div class="calendar-day-events">${dayEvents.slice(0, 2).map(eventButton).join('')}${dayEvents.length > 2 ? `<button class="calendar-more" type="button" data-calendar-agenda aria-label="Consulter les ${dayEvents.length} événements du ${clean(fullDayFormat.format(day))} dans l’agenda">+ ${dayEvents.length - 2} autre${dayEvents.length > 3 ? 's' : ''} · agenda</button>` : ''}</div><span class="calendar-mobile-count" aria-hidden="true">${dayEvents.length}</span>` : ''}</div></td>`;
      if (offset % 7 === 6) cells += '</tr>';
    }
    days.innerHTML = cells;
    root.querySelector('#calendar-event-count').textContent = `${inMonth.length} événement${inMonth.length > 1 ? 's' : ''}`;
    agenda.innerHTML = inMonth.length ? `<ol class="calendar-agenda-list">${inMonth.map(event => {
      const unit = unitFor(event);
      return `<li class="calendar-agenda-item calendar-type-${event.type}"><div class="calendar-agenda-date"><span>${clean(rangeLabel(event))}</span><span class="calendar-category">${eventTypes[event.type]}${event.example ? ' · Exemple fictif' : ''}</span></div><div class="calendar-agenda-body"><h3><button class="calendar-agenda-event" type="button" data-calendar-event="${clean(event.id)}">${clean(event.title)}<span class="calendar-detail-invitation">Consulter le détail →</span></button></h3>${unit ? `<a class="text-link" href="uc.html?id=${encodeURIComponent(unit.id)}">${clean(unit.code)} · ${clean(unit.title)}</a>` : event.type === 'examen' ? '<p class="calendar-unit-missing">UC non renseignée</p>' : ''}${event.location ? `<p>${clean(event.location)}</p>` : ''}${event.start < first || event.end > last ? '<p class="calendar-continuation">Cette période se poursuit sur plusieurs mois.</p>' : ''}</div></li>`;
    }).join('')}</ol>` : `<div class="calendar-month-empty"><strong>${data.error ? 'L’agenda n’est pas disponible.' : 'Un mois sans événement renseigné.'}</strong><p>${data.error ? 'Les dates s’afficheront dès que le calendrier sera de nouveau accessible.' : 'Aucun cours, stage, congé ou examen n’est enregistré pour ce mois.'}</p></div>`;
  }

  function openEvent(id) {
    const event = events.find(item => item.id === id);
    if (!event) return;
    const unit = unitFor(event);
    root.querySelector('#calendar-detail-content').innerHTML = `<span class="calendar-category calendar-type-${event.type}">${eventTypes[event.type]}${event.example ? ' · Exemple fictif' : ''}</span><h2 id="calendar-detail-title">${clean(event.title)}</h2><dl class="calendar-detail-facts"><div><dt>Date${event.start !== event.end ? 's' : ''}</dt><dd>${clean(rangeLabel(event))}</dd></div>${unit ? `<div><dt>Unité capitalisable</dt><dd><a class="text-link" href="uc.html?id=${encodeURIComponent(unit.id)}">${clean(unit.code)} · ${clean(unit.title)}</a></dd></div>` : event.type === 'examen' ? '<div><dt>Unité capitalisable</dt><dd>UC non renseignée</dd></div>' : ''}${event.location ? `<div><dt>Lieu</dt><dd>${clean(event.location)}</dd></div>` : ''}</dl>${event.description ? `<p class="calendar-description">${clean(event.description)}</p>` : '<p>Aucune précision complémentaire pour cet événement.</p>'}${event.example ? '<p class="calendar-example-note">Cet événement est un exemple fictif. Il ne correspond pas à une date réelle de formation et n’entre pas dans le bandeau de préparation.</p>' : ''}`;
    dialog.showModal();
  }

  on(root, 'click', event => {
    const step = event.target.closest('[data-month-step]');
    if (step) {
      displayed = new Date(displayed);
      displayed.setMonth(displayed.getMonth() + Number(step.dataset.monthStep));
      refresh();
    }
    if (event.target.closest('[data-calendar-today]')) {
      displayed = parseDate(todayKey());
      displayed.setDate(1);
      refresh();
    }
    const button = event.target.closest('[data-calendar-event]');
    if (button) openEvent(button.dataset.calendarEvent);
    if (event.target.closest('[data-calendar-agenda]')) {
      const heading = root.querySelector('#calendar-agenda-title');
      heading.scrollIntoView({ block: 'start' });
      heading.focus({ preventScroll: true });
    }
    if (event.target.closest('[data-calendar-retry]')) initCalendar(root);
  });
  on(monthInput, 'change', () => {
    const chosen = parseDate(`${monthInput.value}-01`);
    if (chosen) { displayed = chosen; refresh(); }
  });
  on(dialog, 'click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  refresh();
  if (requestedEvent) openEvent(requestedEvent.id);
}
