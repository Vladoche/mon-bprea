import { units, lessons } from './content.js';
import { initAuthHeader } from './auth-header.js';

const fallbackItems = [
  { id: 'home', label: 'Accueil', href: 'index.html', pages: ['home'] },
  { id: 'courses', label: 'Mes cours', href: 'mes-cours.html', pages: ['courses', 'uc', 'course', 'quiz', 'practice', 'drill', 'dashboard', 'calendar'] },
  { id: 'tools', label: 'Outils', href: 'outils.html', pages: ['tools', 'itk', 'resources'] },
];
const instances = new WeakMap();
let configurationPromise;
const navigationIcons = {
  home: '<path d="m3 10 9-7 9 7v10H3V10Z"/><path d="M9 20v-7h6v7"/>',
  courses: '<path d="M3 5.5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1v-14ZM12 6.5v14"/>',
  tools: '<path d="m14 6 4-3 3 3-3 4m-4-4-9 9a3 3 0 0 0 4 4l9-9m-4-4 4 4M3 3l5 2 1 4-2 2-4-1-2-5m8 6 3 3"/>',
  itk: '<path d="M9 3h6m-5 0v6L4 19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2L14 9V3M7 15h10"/>',
  resources: '<path d="M3 5.5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1v-14ZM12 6.5v14"/>',
  botanical: '<path d="M20 4c-9-1-15 2-15 8a6 6 0 0 0 6 6c6 0 9-6 9-14ZM4 21 15 10"/>',
  drill: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9V3ZM8 13l2 2 5-5M8 18h8"/>',
  dashboard: '<path d="M4 20h16M7 16V9m5 7V4m5 12v-4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
};

function validEntry(entry) {
  return entry && typeof entry === 'object' && typeof entry.id === 'string' && /^[a-z0-9-]+$/.test(entry.id) &&
    typeof entry.label === 'string' && Boolean(entry.label.trim()) && typeof entry.href === 'string' &&
    /^[a-z0-9-]+\.html$/.test(entry.href) &&
    (entry.pages === undefined || Array.isArray(entry.pages) && entry.pages.every(page => typeof page === 'string'));
}

async function readConfiguration() {
  try {
    const response = await fetch(new URL('./navigation.json', import.meta.url), { cache: 'no-cache' });
    if (!response.ok) throw new Error('unavailable');
    const data = await response.json();
    if (data?.version !== 1 || !Array.isArray(data.items) || data.items.length !== 3 ||
      data.items.some((item, index) => !validEntry(item) || !Array.isArray(item.pages) || item.id !== ['home', 'courses', 'tools'][index])) throw new Error('format');
    const courses = data.items[1];
    if (!Array.isArray(courses.groups) || courses.groups.length !== 2 || courses.groups[0]?.source !== 'units' ||
      courses.groups.some(group => !validEntry(group)) || !Array.isArray(courses.groups[1].children) ||
      courses.groups[1].children.some(child => !validEntry(child)) || !Array.isArray(data.items[2].children) ||
      data.items[2].children.some(child => !validEntry(child))) throw new Error('groups');
    return data.items;
  } catch {
    return fallbackItems;
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function currentUnit(page) {
  const id = new URLSearchParams(location.search).get('id');
  if (page === 'uc') return units.some(unit => unit.id === id) ? id : null;
  return ['course', 'quiz'].includes(page) ? lessons.find(lesson => lesson.id === id)?.unit ?? null : null;
}

function createLink(entry, page, selectedUnit, className = 'primary-nav__link') {
  const link = element('a', className);
  link.href = entry.href;
  if (entry.unitId) {
    link.append(element('span', 'primary-nav__unit-code', entry.code), element('span', 'primary-nav__unit-title', entry.label));
    if (entry.unitId === selectedUnit) link.classList.add('active');
    if (page === 'uc' && entry.unitId === selectedUnit) link.setAttribute('aria-current', 'page');
  } else {
    link.textContent = entry.label;
    if (['primary-nav__top-link', 'primary-nav__link'].includes(className) && navigationIcons[entry.id]) {
      const label = element('span', '', entry.label);
      link.innerHTML = `<svg class="primary-nav__icon${className === 'primary-nav__link' ? ' primary-nav__link-icon' : ''}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${navigationIcons[entry.id]}</svg>`;
      link.append(label);
    }
    if (entry.pages?.includes(page)) link.classList.add('active');
    if (entry.source === 'units' && ['courses', 'uc', 'course', 'quiz'].includes(page)) link.classList.add('active');
    // The first page identifies the actual destination; remaining pages merely
    // mark its parent section. A parent must never claim to be the current page.
    if (entry.pages?.[0] === page) link.setAttribute('aria-current', 'page');
  }
  return link;
}

function createLinks(entries, page, selectedUnit, isUnits = false) {
  const list = element('ul', `primary-nav__links${isUnits ? ' primary-nav__links--units' : ''}`);
  for (const entry of entries) {
    const item = element('li');
    item.append(createLink(entry, page, selectedUnit));
    list.append(item);
  }
  return list;
}

function renderNavigation(root, items, page) {
  const selectedUnit = currentUnit(page);
  const list = element('ul', 'primary-nav__list');
  const panels = new Map();
  const panelNodes = [];
  for (const entry of items) {
    const item = element('li', 'primary-nav__item');
    if (entry.pages.includes(page)) item.classList.add('active');
    const line = element('div', 'primary-nav__entry');
    const link = createLink(entry, page, selectedUnit, 'primary-nav__top-link');
    link.id = `${root.id}-${entry.id}-link`;
    line.append(link);
    if (entry.groups || entry.children) {
      const button = element('button', 'primary-nav__toggle');
      button.type = 'button';
      button.dataset.navigationToggle = entry.id;
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', `Afficher les sous-rubriques de ${entry.label}`);
      const panel = element('div', `primary-nav__panel primary-nav__panel--${entry.id}`);
      panel.id = `${root.id}-${entry.id}-panel`;
      panel.hidden = true;
      panel.setAttribute('role', 'group');
      panel.setAttribute('aria-labelledby', link.id);
      button.setAttribute('aria-controls', panel.id);
      button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
      line.append(button);
      if (entry.groups) {
        for (const group of entry.groups) {
          const section = element('div', 'primary-nav__group');
          const heading = element('p', 'primary-nav__group-heading');
          heading.append(createLink(group, page, selectedUnit, 'primary-nav__group-link'));
          const children = group.source === 'units' ? units.map(unit => ({
            id: unit.id, unitId: unit.id, code: unit.code, label: unit.title, href: `uc.html?id=${encodeURIComponent(unit.id)}`,
          })) : group.children;
          section.append(heading, createLinks(children, page, selectedUnit, group.source === 'units'));
          panel.append(section);
        }
      } else {
        panel.append(createLinks(entry.children, page, selectedUnit));
      }
      panels.set(entry.id, { button, panel, label: entry.label });
      panelNodes.push(panel);
    }
    item.append(line);
    list.append(item);
  }
  const account = element('li', 'primary-nav__item account-actions');
  account.innerHTML = '<div class="primary-nav__entry"><span class="primary-nav__top-link" role="status">Vérification…</span></div>';
  list.append(account);
  // Full-width panels stay outside the four entries, including the mobile grid.
  root.replaceChildren(list, ...panelNodes);
  return panels;
}

/** Native links and disclosure buttons: no menubar role, roving focus or storage. */
export async function initNavigation(root, page = document.body.dataset.page) {
  if (!root) return;
  instances.get(root)?.abort();
  const controller = new AbortController();
  instances.set(root, controller);
  const { signal } = controller;
  root.classList.add('primary-nav');
  if (!root.id) root.id = 'primary-navigation';
  root.setAttribute('aria-label', 'Navigation principale');
  renderNavigation(root, fallbackItems, page);
  if (!configurationPromise) configurationPromise = readConfiguration();
  const items = await configurationPromise;
  if (signal.aborted) return;
  const panels = renderNavigation(root, items, page);
  initAuthHeader(root.querySelector('.account-actions'), page);
  const desktop = matchMedia('(min-width: 601px)');
  let lastOpened = null;
  let positionFrame = 0;

  // Account state can replace its disclosure without rebuilding navigation or
  // attaching a second set of keyboard/outside-click handlers.
  function entries() {
    const accountButton = root.querySelector('[data-navigation-toggle="profile"]');
    const accountPanel = accountButton && document.getElementById(accountButton.getAttribute('aria-controls'));
    return [...panels.values(), ...(accountPanel ? [{ button: accountButton, panel: accountPanel, label: 'Mon profil' }] : [])];
  }

  function setOpen(entry, open) {
    entry.panel.inert = !open;
    entry.panel.hidden = !open;
    if (open) entry.panel.removeAttribute('aria-hidden');
    else entry.panel.setAttribute('aria-hidden', 'true');
    entry.button.setAttribute('aria-expanded', String(open));
    entry.button.setAttribute('aria-label', `${open ? 'Masquer' : 'Afficher'} les sous-rubriques de ${entry.label}`);
    entry.button.closest('.primary-nav__entry').classList.toggle('is-open', open);
    if (open) positionPanel(entry);
  }
  // Panels keep their native disclosure semantics outside the entry list.
  // Measure only visible panels, on opening or a relevant layout change.
  function positionPanel(entry) {
    const { panel, button } = entry;
    if (!desktop.matches) {
      panel.style.removeProperty('left');
      panel.style.removeProperty('top');
      panel.style.removeProperty('--nav-panel-height');
      return;
    }
    const parent = panel.offsetParent.getBoundingClientRect();
    const anchor = button.closest('.primary-nav__entry').getBoundingClientRect();
    // offsetWidth ignores the short entry/exit transform animation.
    const width = panel.offsetWidth;
    const preferred = button.dataset.navigationToggle === 'profile' ? anchor.right - width : (anchor.left + anchor.right - width) / 2;
    const left = Math.max(parent.left, Math.min(preferred, parent.right - width));
    const top = anchor.bottom - parent.top + 12;
    panel.style.left = `${left - parent.left}px`;
    panel.style.top = `${top}px`;
    panel.style.setProperty('--nav-panel-height', `${Math.max(100, innerHeight - anchor.bottom - 28)}px`);
  }
  function schedulePosition() {
    if (positionFrame || !entries().some(entry => !entry.panel.hidden)) return;
    positionFrame = requestAnimationFrame(() => {
      positionFrame = 0;
      entries().filter(entry => !entry.panel.hidden).forEach(positionPanel);
    });
  }
  function closeAll() {
    for (const entry of entries()) setOpen(entry, false);
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('button[data-navigation-toggle]');
    if (button && root.contains(button)) {
      const entry = entries().find(candidate => candidate.button === button);
      if (!entry) return;
      const open = entry.panel.hidden;
      closeAll();
      setOpen(entry, open);
      if (open) {
        lastOpened = entry;
        // Opening takes keyboard users straight to the disclosed destinations.
        entry.panel.querySelector('a,button')?.focus();
      }
    } else if (event.target.closest('a')) {
      closeAll();
    }
  }, { signal });
  root.addEventListener('keydown', event => {
    if (event.key === 'Tab' && !event.shiftKey) {
      const entry = entries().find(candidate => !candidate.panel.hidden && candidate.button === event.target);
      if (entry) {
        event.preventDefault();
        entry.panel.querySelector('a,button')?.focus();
        return;
      }
    }
    if (event.key === 'Tab' && event.shiftKey) {
      const entry = entries().find(candidate => !candidate.panel.hidden && candidate.panel.querySelector('a,button') === event.target);
      if (entry) {
        event.preventDefault();
        entry.button.focus();
        return;
      }
    }
    if (event.key !== 'Escape') return;
    const open = entries().filter(entry => !entry.panel.hidden);
    if (!open.length) return;
    const entry = open.find(candidate => candidate.panel.contains(event.target) || candidate.button === event.target) ?? (open.includes(lastOpened) ? lastOpened : open[0]);
    event.preventDefault();
    event.stopPropagation();
    closeAll();
    entry.button.focus();
  }, { signal });
  document.addEventListener('pointerdown', event => { if (!root.contains(event.target)) closeAll(); }, { signal });
  document.addEventListener('focusin', event => { if (!root.contains(event.target)) closeAll(); }, { signal });
  desktop.addEventListener('change', () => {
    const focused = entries().find(entry => entry.panel.contains(document.activeElement));
    closeAll();
    focused?.button.focus();
  }, { signal });
  window.addEventListener('resize', schedulePosition, { signal });
  const layout = new ResizeObserver(schedulePosition);
  layout.observe(root.closest('.header-in') || root);
  // Late identity and text/preference changes can resize entries while the
  // outer header keeps exactly the same dimensions.
  root.querySelectorAll('.primary-nav__list > li').forEach(item => layout.observe(item));
  signal.addEventListener('abort', () => { layout.disconnect(); cancelAnimationFrame(positionFrame); }, { once: true });
}
