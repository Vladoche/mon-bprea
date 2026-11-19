import { units } from './content.js';
import { renderBreadcrumbs } from './breadcrumbs.js';
import { loadCalendar, parseDate, dateKey, todayKey, eventTypes } from './calendar-data.js';

const clean = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const fullDayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const weekdays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const controllers = new WeakMap();
const unitFor = event => units.find(unit => unit.id === event.unit);
const categoryLabel = event => eventTypes[event.type] + (event.example ? ' · Exemple fictif' : '');
const eventCount = count => `${count} événement${count > 1 ? 's' : ''}`;
const coversDay = (event, day) => event.start <= day && event.end >= day;

function dateMarkup(key) {
  return `<time datetime="${key}">${dayFormat.format(parseDate(key))}</time>`;
}

function rangeMarkup(event) {
  return event.start === event.end ? dateMarkup(event.start) : `Du ${dateMarkup(event.start)} au ${dateMarkup(event.end)}`;
}

function category(event) {
  return `<span class="calendar-category calendar-type-${event.type}">${categoryLabel(event)}</span>`;
}

function unitLink(unit) {
  return `<a class="text-link" href="uc.html?id=${encodeURIComponent(unit.id)}">${clean(unit.code)} · ${clean(unit.title)}</a>`;
}

function pageMarkup() {
  return `
    <header class="page-top wrap calendar-intro">
      ${renderBreadcrumbs('calendar')}
      <h1>Calendrier de formation</h1>
      <p>Retrouve les cours, les stages, les vacances et les examens de ta formation.</p>
    </header>
    <div class="wrap calendar-section">
      <section class="calendar-board" aria-labelledby="calendar-month-title">
        <div class="calendar-toolbar">
          <h2 id="calendar-month-title" aria-live="polite" aria-atomic="true" tabindex="-1"></h2>
          <div class="calendar-controls">
            <div class="calendar-month-nav" role="group" aria-label="Navigation entre les mois">
              <button class="btn btn-surface calendar-arrow" type="button" data-month-step="-1" aria-label="Mois précédent">←</button>
              <button class="btn btn-surface" type="button" data-calendar-today>Aujourd’hui</button>
              <button class="btn btn-surface calendar-arrow" type="button" data-month-step="1" aria-label="Mois suivant">→</button>
            </div>
            <label class="calendar-month-choice">Aller au mois
              <input type="month" id="calendar-month-input" min="0001-01" max="9999-12" placeholder="AAAA-MM" />
            </label>
          </div>
        </div>
        <div class="calendar-source-feedback"></div>
        <table class="calendar-grid" aria-labelledby="calendar-month-title">
          <thead><tr>${weekdays.map(day => `<th scope="col" aria-label="${day}"><abbr title="${day}">${day.slice(0, 3)}</abbr></th>`).join('')}</tr></thead>
          <tbody id="calendar-days"></tbody>
        </table>
        <div class="calendar-grid-footer">
          <ul class="calendar-legend" role="list" aria-label="Catégories d’événements">
            ${Object.entries(eventTypes).map(([type, label]) => `<li class="calendar-category calendar-type-${type}">${label}</li>`).join('')}
          </ul>
          <a class="calendar-agenda-link" href="#calendar-agenda-title" data-calendar-agenda>Voir l’agenda <span aria-hidden="true">↓</span></a>
          <p class="calendar-grid-note calendar-grid-hint" hidden>Choisis un nombre pour ouvrir l’agenda du jour.</p>
          <p class="calendar-grid-note calendar-grid-example" hidden>* Exemple fictif</p>
        </div>
      </section>
      <section class="calendar-agenda" aria-labelledby="calendar-agenda-title">
        <div class="calendar-agenda-heading">
          <h2 id="calendar-agenda-title" tabindex="-1">Agenda du mois</h2>
          <span id="calendar-event-count" class="calendar-count"></span>
          <button class="btn btn-surface calendar-reset" type="button" hidden>Voir tout le mois</button>
        </div>
        <div class="calendar-feedback"></div>
        <div id="calendar-agenda-content"></div>
      </section>
    </div>
    <dialog class="calendar-dialog" aria-labelledby="calendar-detail-title">
      <div class="calendar-dialog-content" id="calendar-detail-content"></div>
      <form method="dialog" class="calendar-dialog-actions">
        <button class="btn btn-surface" type="submit">Fermer le détail</button>
      </form>
    </dialog>`;
}

function eventButton(event) {
  const unit = unitFor(event);
  const label = `${categoryLabel(event)} : ${event.title}${unit ? `, ${unit.code}` : ''}. Consulter le détail.`;
  return `<button type="button" class="calendar-event calendar-type-${event.type}" data-calendar-event="${clean(event.id)}" aria-label="${clean(label)}" title="${clean(event.title)}">
    <span class="calendar-event-type">${categoryLabel(event)}${unit ? ` · ${clean(unit.code)}` : ''}</span>
    <span class="calendar-event-title">${clean(event.title)}</span>
  </button>`;
}

function dayMarkup(day, month, offset, today, inMonth) {
  const key = dateKey(day);
  const outside = day.getMonth() !== month;
  const current = key === today;
  const dayLabel = fullDayFormat.format(day);
  const classes = [outside && 'calendar-outside', current && 'calendar-today', offset % 7 > 4 && 'calendar-weekend'].filter(Boolean);
  const dayEvents = outside ? [] : inMonth.filter(event => coversDay(event, key));
  const examples = dayEvents.filter(event => event.example).length;
  const hiddenExample = dayEvents.slice(2).some(event => event.example);
  const types = [...new Set(dayEvents.map(event => event.type))];
  const countStyle = types.length === 1 ? `calendar-type-${types[0]}` : '';
  const exampleLabel = examples ? `, dont ${examples} exemple${examples === 1 ? ' fictif' : 's fictifs'}` : '';
  const agendaLabel = `Voir ${eventCount(dayEvents.length)} du ${dayLabel} dans l’agenda${exampleLabel}. ${types.map(type => eventTypes[type]).join(', ')}.`;
  const moreLabel = `+ ${dayEvents.length - 2}${hiddenExample ? '*' : ''} · agenda`;
  return `<td class="${classes.join(' ')}"><div class="calendar-day">
    <div class="calendar-day-heading">
      <time datetime="${key}" class="calendar-day-number" aria-label="${dayLabel}${outside ? ', hors du mois affiché' : ''}"${current ? ' aria-current="date"' : ''}>${day.getDate()}</time>
      ${current && !outside ? '<span class="calendar-today-label" aria-hidden="true">Aujourd’hui</span>' : ''}
    </div>
    ${dayEvents.length ? `
      <div class="calendar-day-events">${dayEvents.slice(0, 2).map(eventButton).join('')}
        ${dayEvents.length > 2 ? `<button class="calendar-more" type="button" data-calendar-day="${key}" aria-label="${moreLabel}. ${agendaLabel}">${moreLabel}</button>` : ''}
      </div>
      <button class="calendar-mobile-count ${countStyle}" type="button" data-calendar-day="${key}" aria-label="${agendaLabel}"><span aria-hidden="true">${dayEvents.length}${examples ? '*' : ''}</span></button>` : ''}
  </div></td>`;
}

function agendaItem(event, first, last) {
  const unit = unitFor(event);
  return `<li class="calendar-agenda-item calendar-type-${event.type}">
    <div class="calendar-agenda-date">
      <div>${rangeMarkup(event)}</div>
      ${event.start < first || event.end > last ? '<span class="calendar-continuation">Sur plusieurs mois</span>' : ''}
    </div>
    <div class="calendar-agenda-body">
      ${category(event)}
      <h3><button class="calendar-agenda-event" type="button" data-calendar-event="${clean(event.id)}">
        ${clean(event.title)}<span class="calendar-detail-invitation">Consulter le détail <span aria-hidden="true">→</span></span>
      </button></h3>
      ${unit ? unitLink(unit) : event.type === 'examen' ? '<p>UC non renseignée</p>' : ''}
      ${event.location ? `<p>${clean(event.location)}</p>` : ''}
    </div>
  </li>`;
}

function detailMarkup(event) {
  const unit = unitFor(event);
  return `${category(event)}
    <h2 id="calendar-detail-title" tabindex="-1" autofocus>${clean(event.title)}</h2>
    <p class="calendar-detail-date">${rangeMarkup(event)}</p>
    ${unit || event.type === 'examen' || event.location ? `
      <dl class="calendar-detail-facts">
        ${unit ? `<div><dt>Unité capitalisable</dt><dd>${unitLink(unit)}</dd></div>` : event.type === 'examen' ? '<div><dt>Unité capitalisable</dt><dd>UC non renseignée</dd></div>' : ''}
        ${event.location ? `<div><dt>Lieu</dt><dd>${clean(event.location)}</dd></div>` : ''}
      </dl>` : ''}
    ${event.description ? `<p class="calendar-description">${clean(event.description)}</p>` : ''}
    ${event.example ? '<p class="calendar-example-note">Cet exemple fictif ne correspond à aucune date réelle de formation.</p>' : ''}`;
}

export function initCalendar(root) {
  return renderCalendar(root);
}

export function renderCalendar(root, initialData) {
  controllers.get(root)?.abort();
  const controller = new AbortController();
  controllers.set(root, controller);
  const { signal } = controller;
  const on = (element, name, handler) => element.addEventListener(name, handler, { signal });
  const query = new URLSearchParams(location.search);
  const requestedDate = parseDate(query.get('date')) || parseDate(`${query.get('month')}-01`);
  let displayed = requestedDate || parseDate(todayKey());
  displayed.setDate(1);
  let data = null;
  let inMonth = [];
  let first;
  let last;
  let selectedDay = null;
  let returnFocus = null;
  let monthChanged = false;

  root.innerHTML = pageMarkup();
  const monthTitle = root.querySelector('#calendar-month-title');
  const monthInput = root.querySelector('#calendar-month-input');
  const days = root.querySelector('#calendar-days');
  const agenda = root.querySelector('#calendar-agenda-content');
  const agendaSection = root.querySelector('.calendar-agenda');
  const agendaLink = root.querySelector('[data-calendar-agenda]');
  const agendaTitle = root.querySelector('#calendar-agenda-title');
  const count = root.querySelector('#calendar-event-count');
  const clearDay = root.querySelector('.calendar-reset');
  const feedback = root.querySelector('.calendar-feedback');
  const sourceFeedback = root.querySelector('.calendar-source-feedback');
  const dialog = root.querySelector('.calendar-dialog');
  const detail = root.querySelector('#calendar-detail-content');

  function renderAgenda() {
    const available = data && !data.error;
    agendaSection.hidden = !available;
    agendaLink.hidden = !available;
    if (!available) return;

    const list = selectedDay ? inMonth.filter(event => coversDay(event, selectedDay)) : inMonth;
    agendaTitle.textContent = selectedDay ? `Agenda du ${fullDayFormat.format(parseDate(selectedDay))}` : 'Agenda du mois';
    clearDay.hidden = !selectedDay;
    count.textContent = eventCount(list.length);
    const explanation = data.warnings.length && !data.events.length
      ? 'Les informations disponibles doivent être corrigées.'
      : data.events.length ? 'Tu peux consulter les dates enregistrées en parcourant les autres mois.'
        : 'Aucune date de formation n’a encore été renseignée.';
    agenda.innerHTML = list.length
      ? `<ol class="calendar-agenda-list" role="list">${list.map(event => agendaItem(event, first, last)).join('')}</ol>`
      : `<div class="calendar-month-empty"><strong>Aucun événement prévu dans ce mois.</strong><p>${explanation}</p></div>`;
  }

  function refresh() {
    const year = displayed.getFullYear();
    const month = displayed.getMonth();
    first = dateKey(displayed);
    const lastDate = new Date(displayed);
    lastDate.setMonth(month + 1, 0);
    last = dateKey(lastDate);
    inMonth = (data?.events || []).filter(event => event.start <= last && event.end >= first);
    const label = monthFormat.format(displayed);
    if (monthTitle.textContent !== label) monthTitle.textContent = label;
    monthInput.value = first.slice(0, 7);
    root.querySelector('[data-month-step="-1"]').disabled = year === 1 && month === 0;
    root.querySelector('[data-month-step="1"]').disabled = year === 9999 && month === 11;

    const leadingDays = (displayed.getDay() + 6) % 7;
    const start = new Date(displayed);
    start.setDate(1 - leadingDays);
    const weekCount = Math.ceil((leadingDays + lastDate.getDate()) / 7);
    const today = todayKey();
    days.innerHTML = Array.from({ length: weekCount }, (_, week) => {
      const cells = weekdays.map((_, column) => {
        const offset = week * 7 + column;
        const day = new Date(start);
        day.setDate(start.getDate() + offset);
        return dayMarkup(day, month, offset, today, inMonth);
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    root.querySelector('.calendar-grid-hint').hidden = !inMonth.length;
    root.querySelector('.calendar-grid-example').hidden = !inMonth.some(event => event.example);
    selectedDay = null;
    renderAgenda();
  }

  function openEvent(event, trigger = null) {
    if (!event || dialog.open) return;
    returnFocus = trigger || monthTitle;
    detail.innerHTML = detailMarkup(event);
    dialog.showModal();
    detail.scrollTop = 0;
  }

  function showData(nextData) {
    data = nextData;
    const requestedEvent = data.events.find(event => event.id === query.get('event'));
    if (requestedEvent && !requestedDate && !monthChanged) {
      displayed = parseDate(requestedEvent.start);
      displayed.setDate(1);
    }

    if (data.error) {
      sourceFeedback.innerHTML = `<div class="calendar-notice calendar-notice-error">
        <div role="alert"><strong>Calendrier indisponible</strong><p>${clean(data.error)}</p></div>
        <button class="btn btn-surface" type="button" data-calendar-retry>Réessayer</button>
      </div>`;
    } else {
      sourceFeedback.innerHTML = '';
      feedback.innerHTML = data.warnings.length ? `<details class="calendar-notice calendar-warnings">
        <summary>Certaines informations sont incomplètes (${data.warnings.length})</summary>
        <ul>${data.warnings.map(warning => `<li>${clean(warning)}</li>`).join('')}</ul>
      </details>` : '';
    }
    refresh();
    openEvent(requestedEvent);
  }

  async function reload(restoreFocus = false) {
    sourceFeedback.innerHTML = '<p class="calendar-notice calendar-loading" role="status" tabindex="-1">Chargement des événements de formation…</p>';
    const loading = sourceFeedback.firstElementChild;
    if (restoreFocus) loading.focus({ preventScroll: true });
    const nextData = await loadCalendar();
    if (signal.aborted) return nextData;
    const hadFocus = document.activeElement === loading;
    showData(nextData);
    if (hadFocus && !dialog.open) {
      const target = sourceFeedback.querySelector('[data-calendar-retry]') || monthTitle;
      target.focus({ preventScroll: true });
    }
    return nextData;
  }

  function goToMonth(date, control) {
    displayed = date;
    displayed.setDate(1);
    monthChanged = true;
    refresh();
    if (control.disabled) monthTitle.focus({ preventScroll: true });
  }

  function showAgenda(day) {
    if (selectedDay !== day) {
      selectedDay = day;
      renderAgenda();
    }
    agendaTitle.focus({ preventScroll: true });
    agendaTitle.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  on(root, 'click', event => {
    const step = event.target.closest('[data-month-step]');
    if (step) {
      const date = new Date(displayed);
      date.setMonth(date.getMonth() + Number(step.dataset.monthStep));
      goToMonth(date, step);
    }
    const today = event.target.closest('[data-calendar-today]');
    if (today) goToMonth(parseDate(todayKey()), today);

    const button = event.target.closest('[data-calendar-event]');
    if (button) openEvent(inMonth.find(item => item.id === button.dataset.calendarEvent), button);

    const day = event.target.closest('[data-calendar-day]');
    if (day) showAgenda(day.dataset.calendarDay);
    if (event.target.closest('[data-calendar-agenda], .calendar-reset')) {
      event.preventDefault();
      showAgenda(null);
    }
    if (event.target.closest('[data-calendar-retry]')) reload(true);
  });

  on(monthInput, 'change', () => {
    const chosen = parseDate(`${monthInput.value}-01`);
    if (chosen) goToMonth(chosen, monthInput);
  });

  on(dialog, 'close', () => {
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  });
  on(dialog, 'click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });

  if (initialData) {
    showData({ events: [], warnings: [], ...initialData });
    return;
  }
  refresh();
  return reload();
}
