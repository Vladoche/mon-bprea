import { units } from './content.js';

const clean = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const home = { label: 'Accueil', href: 'index.html' };
const courses = { label: 'Mes cours', href: 'mes-cours.html' };
const practice = { label: 'S’exercer', href: 's-exercer.html' };
const tools = { label: 'Outils', href: 'outils.html' };

/** Anchor on the existing UC page; no new chapter or lesson identifier is saved. */
export function chapterAnchor(chapter) {
  const slug = String(chapter || '').normalize('NFKD').replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  return `chapitre-${slug || 'sans-intitule'}`;
}

/** One breadcrumb hierarchy for every renderer, including async empty/error states. */
export function renderBreadcrumbs(page, { unit, lesson } = {}) {
  let path;
  if (['uc', 'course', 'quiz'].includes(page)) {
    const currentUnit = unit || units.find(item => item.id === lesson?.unit);
    path = [home, courses];
    if (currentUnit) path.push({ label: currentUnit.code, href: `uc.html?id=${encodeURIComponent(currentUnit.id)}` });
    if (lesson) {
      if (lesson.chapter && currentUnit) path.push({ label: lesson.chapter, href: `uc.html?id=${encodeURIComponent(currentUnit.id)}#${encodeURIComponent(chapterAnchor(lesson.chapter))}` });
      path.push({ label: lesson.title, href: `cours.html?id=${encodeURIComponent(lesson.id)}` });
    }
    if (page === 'quiz') path.push({ label: 'Exercices du cours' });
  } else {
    path = {
      home: [home],
      courses: [home, courses],
      practice: [home, courses, practice],
      drill: [home, courses, practice, { label: 'Exercices hebdomadaires' }],
      dashboard: [home, courses, practice, { label: 'Tableau de bord' }],
      calendar: [home, courses, practice, { label: 'Calendrier' }],
      tools: [home, tools],
      itk: [home, tools, { label: 'Générateur ITK' }],
      resources: [home, tools, { label: 'Ressources documentaires' }],
      botanical: [home, tools, { label: 'Reconnaissance des plantes' }],
      'auth-login': [home, { label: 'Connexion' }],
      'auth-reset': [home, { label: 'Connexion', href: 'connexion.html' }, { label: 'Mot de passe oublié' }],
      'auth-callback': [home, { label: 'Activation et mot de passe' }],
      profile: [home, { label: 'Mon profil' }],
    }[page] || [home];
  }
  return `<nav class="crumbs" aria-label="Fil d’Ariane"><ol>${path.map((item, index) => `<li>${index ? '<span class="crumb-separator" aria-hidden="true">/</span>' : ''}${index === path.length - 1 ? `<span aria-current="page">${clean(item.label)}</span>` : `<a href="${clean(item.href)}">${clean(item.label)}</a>`}</li>`).join('')}</ol></nav>`;
}
