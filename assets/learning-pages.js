import { renderBreadcrumbs, chapterAnchor } from './breadcrumbs.js';

const clean = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const courseUrl = id => `cours.html?id=${encodeURIComponent(id)}`;
const unitUrl = id => `uc.html?id=${encodeURIComponent(id)}`;
const quizUrl = id => `exercices.html?id=${encodeURIComponent(id)}`;

/** Stable sort: order is the existing pedagogical order inside this UC only. */
export function unitLessons(lessons, unitId) {
  return lessons.filter(lesson => lesson.unit === unitId).sort((a, b) => a.order - b.order);
}

function chaptersFor(list) {
  const chapters = new Map();
  list.forEach(lesson => {
    if (!chapters.has(lesson.chapter)) chapters.set(lesson.chapter, []);
    chapters.get(lesson.chapter).push(lesson);
  });
  return [...chapters];
}

function lessonsList(list, icon) {
  return `<ol class="unit-lessons">${list.map(lesson => `<li><a href="${courseUrl(lesson.id)}" class="lesson-row" aria-labelledby="lesson-${clean(lesson.id)}-title" aria-describedby="lesson-${clean(lesson.id)}-summary lesson-${clean(lesson.id)}-meta"><span class="lesson-number" aria-hidden="true">${String(lesson.order).padStart(2, '0')}</span><span class="lesson-details"><strong id="lesson-${clean(lesson.id)}-title">${clean(lesson.title)}</strong><span id="lesson-${clean(lesson.id)}-summary">${clean(lesson.summary)}</span><span class="lesson-meta" id="lesson-${clean(lesson.id)}-meta"><span>${lesson.minutes} min de lecture</span><span data-course-card-state="${clean(lesson.id)}">Progression indisponible</span></span></span><span class="lesson-access" aria-hidden="true">${icon('arrow', 20)}</span></a></li>`).join('')}</ol>`;
}

export function renderUnit(unit, lessons, icon) {
  const list = unitLessons(lessons, unit.id), chapters = chaptersFor(list);
  return `<section class="page-top wrap learning-intro">${renderBreadcrumbs('uc', { unit })}<div class="learning-cover"><div class="learning-cover-copy"><span class="page-eyebrow">${clean(unit.code)} · BPREA</span><h1>${clean(unit.title)}</h1><p>${clean(unit.short)}</p><div class="learning-meta"><span>${list.length} cours disponible${list.length > 1 ? 's' : ''}</span><span>${list.length ? `${chapters.length} chapitre${chapters.length > 1 ? 's' : ''}` : 'Contenus à venir'}</span></div></div><span class="unit-icon tone-${clean(unit.tone)}" aria-hidden="true">${icon(unit.icon, 32)}</span></div></section>
    <div class="wrap unit-layout"><div class="unit-content"><section class="unit-syllabus" aria-labelledby="unit-syllabus-title"><div class="panel-heading"><div><span class="eyebrow">TON PARCOURS DANS CETTE UNITÉ</span><h2 id="unit-syllabus-title">${list.length ? 'Chapitres et cours' : 'Contenus à venir'}</h2></div></div>${list.length ? `<nav class="chapter-index" aria-label="Sommaire des chapitres"><ul>${chapters.map(([title, items]) => `<li><a href="#${clean(chapterAnchor(title))}">${clean(title)} <span>${items.length} cours</span></a></li>`).join('')}</ul></nav>${chapters.map(([title, items], index) => `<section class="course-chapter" id="${clean(chapterAnchor(title))}" tabindex="-1" aria-labelledby="${clean(chapterAnchor(title))}-title"><div class="course-chapter-heading"><span class="chapter-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><div><h3 id="${clean(chapterAnchor(title))}-title">${clean(title)}</h3><p>${items.length} cours disponible${items.length > 1 ? 's' : ''}</p></div></div>${lessonsList(items, icon)}</section>`).join('')}` : `<div class="unit-empty"><span class="empty-icon">${icon(unit.icon, 30)}</span><h3>Cette unité prend bientôt racine.</h3><p>Les contenus de cette unité ne sont pas encore disponibles. Retrouve les cours de démonstration existants dans l’UC 03.</p><div class="learning-actions"><a class="btn btn-surface" href="mes-cours.html">Retour à Mes cours</a><a class="text-link" href="${unitUrl('uc3')}">Découvrir l’UC 03 ${icon('arrow', 17)}</a></div></div>`}</section><section id="unit-resources" aria-label="Ressources associées à cette UC"></section></div>
    <aside class="unit-aside" aria-label="Repères de cette unité">${list.length ? `<section class="learning-card unit-progress"><span class="eyebrow">MON AVANCEMENT</span><h2>Un cours à la fois</h2><p data-unit-progress-label="${clean(unit.id)}">Progression indisponible</p><progress data-unit-progress="${clean(unit.id)}" max="100" aria-label="Cours terminés · ${clean(unit.code)}" hidden></progress><p data-learning-source>Vérification de la progression…</p></section>` : ''}<section class="learning-card unit-notice"><span class="eyebrow">À SAVOIR</span><h2>Un support indépendant</h2><p>Ce n’est pas un support officiel. Les intitulés nationaux correspondent au BPREA, mais les chapitres de la démo sont libres et doivent être ajustés à ta formation.</p><a class="text-link" href="mes-cours.html">Toutes les UC et UCARE ${icon('arrow', 17)}</a></section></aside></div>`;
}

export function renderCourse(lesson, unit, lessons, icon) {
  const list = unitLessons(lessons, lesson.unit), next = list[list.indexOf(lesson) + 1];
  return `<section class="page-top wrap learning-intro">${renderBreadcrumbs('course', { lesson })}<div class="learning-cover course-cover"><div class="learning-cover-copy"><div class="page-eyebrow">${clean(unit?.code || '')} · ${clean(lesson.chapter)}</div><h1>${clean(lesson.title)}</h1><p>${clean(lesson.summary)}</p><div class="learning-meta"><span>${lesson.minutes} min de lecture</span><span>${clean(lesson.level)}</span><span>Cours de démonstration</span></div></div><span class="unit-icon tone-${clean(unit?.tone || 'green')}" aria-hidden="true">${icon('book', 32)}</span></div></section>
    <div class="wrap reading-layout"><nav class="learning-card reading-toc" aria-labelledby="reading-toc-title" hidden><span class="eyebrow">DANS CE COURS</span><h2 id="reading-toc-title">Sommaire</h2><ol></ol></nav>
    <article class="content-panel course-article" aria-label="Contenu du cours"><div class="reading-body">${lesson.body}</div><section id="course-resources" aria-label="Ressources associées à ce cours"></section></article>
    <section class="learning-card reading-essentials" aria-labelledby="essentials-title"><span class="eyebrow">POUR RETENIR</span><h2 id="essentials-title">L’essentiel</h2><ul class="essentials">${lesson.essentials.map(item => `<li>${icon('check', 17)}<span>${clean(item)}</span></li>`).join('')}</ul></section>
    <section class="learning-card course-finish" aria-labelledby="course-finish-title"><span class="eyebrow">LA SUITE, À TON RYTHME</span><h2 id="course-finish-title">Fais le point sur ce cours</h2><div class="done-box"><label class="done-toggle"><input type="checkbox" id="mark-done" aria-describedby="done-state"/><span class="check-visual" aria-hidden="true">${icon('check', 14)}</span><span>Marquer ce cours comme terminé</span></label><span id="done-state" role="status" aria-live="polite" aria-atomic="true">Progression indisponible</span><p data-progress-source></p></div><div class="finish-box"><div><h3>Vérifie tes acquis</h3><p>${lesson.quiz.length} question${lesson.quiz.length > 1 ? 's' : ''} corrigée${lesson.quiz.length > 1 ? 's' : ''}, avec un historique de tes tentatives.</p></div><a class="btn btn-surface btn-surface--accent" href="${quizUrl(lesson.id)}">Faire le QCM ${icon('arrow', 17)}</a></div><a class="text-link course-resource-shortcut" href="#course-resources">Revenir aux ressources du cours ↑</a>${next ? `<a class="next-lesson" href="${courseUrl(next.id)}"><span>PROCHAIN COURS<strong>${clean(next.title)}</strong></span>${icon('arrow', 20)}</a>` : `<a class="next-lesson" href="${unitUrl(lesson.unit)}"><span>FIN DES COURS DISPONIBLES<strong>Retrouver ${clean(unit?.code || 'cette unité')}</strong></span>${icon('arrow', 20)}</a>`}</section></div>`;
}

const slug = text => text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section';

/** Only derived DOM: no content edits, saved position or progress writes. */
export function initCourseReading(root) {
  const start = performance.now();
  const body = root.querySelector('.reading-body'), toc = root.querySelector('.reading-toc');
  const headings = [...body.querySelectorAll('h2,h3')];
  const used = new Set([...document.querySelectorAll('[id]')].map(node => node.id));
  for (const heading of headings) {
    if (!heading.id) {
      const base = `section-${slug(heading.textContent)}`;
      let id = base, n = 2;
      while (used.has(id)) id = `${base}-${n++}`;
      heading.id = id; used.add(id);
    }
    heading.tabIndex = -1;
    const item = document.createElement('li'), link = document.createElement('a');
    item.classList.toggle('toc-subsection', heading.tagName === 'H3');
    link.href = `#${encodeURIComponent(heading.id)}`;
    link.textContent = heading.textContent;
    item.append(link); toc.querySelector('ol').append(item);
  }
  toc.hidden = !headings.length;
  body.querySelectorAll('table').forEach((table, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'reading-table'; wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    const preceding = [...headings].reverse().find(heading => heading.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING);
    wrapper.setAttribute('aria-label', `Tableau ${index + 1}${preceding ? ` · ${preceding.textContent}` : ''} · défilement horizontal si nécessaire`);
    table.before(wrapper); wrapper.append(table);
  });
  // Native hash links retain URL/history semantics. Focus follows the heading,
  // including back/forward, without interfering with modified clicks.
  const focusHash = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = id && document.getElementById(id);
    if (target && root.contains(target)) {
      if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start' });
    }
  };
  const onClick = event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      if (link.hash === location.hash) focusHash();
    }
  };
  root.addEventListener('click', onClick);
  window.addEventListener('hashchange', focusHash);
  window.addEventListener('pagehide', () => { root.removeEventListener('click', onClick); window.removeEventListener('hashchange', focusHash); }, { once: true });
  if (location.hash) requestAnimationFrame(focusHash);
  performance.measure('course-reading-init', { start, end: performance.now() });
}
