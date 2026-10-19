import { units, lessons } from './content.js';

const fallbackItems = [
  { id: 'home', label: 'Accueil', href: 'index.html', pages: ['home'] },
  { id: 'courses', label: 'Mes cours', href: 'mes-cours.html', pages: ['courses', 'uc', 'course', 'quiz', 'practice', 'drill', 'dashboard', 'calendar'] },
  { id: 'tools', label: 'Outils', href: 'outils.html', pages: ['tools', 'itk', 'resources'] },
];
const instances = new WeakMap();
let configurationPromise;

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
      button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
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
  // Shared full-width panels preserve a compact three-link mobile row while
  // allowing the two independent disclosures to remain open without overlap.
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
  const desktop = matchMedia('(min-width: 761px)');
  let lastOpened = null;

  function setOpen(entry, open) {
    entry.panel.hidden = !open;
    entry.button.setAttribute('aria-expanded', String(open));
    entry.button.setAttribute('aria-label', `${open ? 'Masquer' : 'Afficher'} les sous-rubriques de ${entry.label}`);
  }
  function closeAll() {
    for (const entry of panels.values()) setOpen(entry, false);
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('button[data-navigation-toggle]');
    if (button && root.contains(button)) {
      const entry = panels.get(button.dataset.navigationToggle);
      const open = entry.panel.hidden;
      if (desktop.matches) closeAll();
      setOpen(entry, open);
      if (open) {
        lastOpened = entry;
        // Opening takes keyboard users straight to the disclosed destinations.
        entry.panel.querySelector('a')?.focus();
      }
    } else if (event.target.closest('a')) {
      closeAll();
    }
  }, { signal });
  root.addEventListener('keydown', event => {
    if (event.key === 'Tab' && !event.shiftKey) {
      const entry = [...panels.values()].find(candidate => !candidate.panel.hidden && candidate.button === event.target);
      if (entry) {
        event.preventDefault();
        entry.panel.querySelector('a')?.focus();
        return;
      }
    }
    if (event.key === 'Tab' && event.shiftKey) {
      const entry = [...panels.values()].find(candidate => !candidate.panel.hidden && candidate.panel.querySelector('a') === event.target);
      if (entry) {
        event.preventDefault();
        entry.button.focus();
        return;
      }
    }
    if (event.key !== 'Escape') return;
    const open = [...panels.values()].filter(entry => !entry.panel.hidden);
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
    const focused = [...panels.values()].find(entry => entry.panel.contains(document.activeElement));
    closeAll();
    focused?.button.focus();
  }, { signal });
}
