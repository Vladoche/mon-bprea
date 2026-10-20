import { lessons } from './content.js';
import { loadResourceCatalog } from './resources.js';

export const DAILY_FACT_EPOCH = '2026-01-01';
export const DAILY_FACT_STORAGE_KEY = 'bprea-demo-daily-fact-dismissed-v1';

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
});
const lessonsById = new Map(lessons.map(lesson => [lesson.id, lesson]));
const controllers = new WeakMap();
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' ? value.trim() : '';
const isId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value);
let factsPromise;
let dismissedInMemory = null;

/** A civil day in Paris, independently of the visitor's browser time zone. */
export function getParisDay(date = new Date()) {
  const parts = Object.fromEntries(dayFormat.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dayNumber(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) return null;
  return date.getTime() / 86400000;
}

/** JSON order is the rotation order; UTC arithmetic avoids 23/25-hour DST days. */
export function selectDailyFact(facts, day = getParisDay()) {
  const number = dayNumber(day);
  if (!Array.isArray(facts) || !facts.length || number === null) return null;
  const offset = number - dayNumber(DAILY_FACT_EPOCH);
  return facts[((offset % facts.length) + facts.length) % facts.length];
}

function referenceUrl(value) {
  const address = text(value);
  if (!/^https?:\/\//i.test(address) || /[\\\u0000-\u001f\u007f]/.test(address)) return null;
  try {
    const url = new URL(address);
    return !url.username && !url.password && ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

/** Optional invalid relations/URLs never remove an otherwise readable fact. */
export function normalizeDailyFacts(document, resources = []) {
  const warnings = [];
  if (!isRecord(document) || document.version !== 1 || !Array.isArray(document.facts)) {
    return { facts: [], warnings, error: 'Le format de la banque d’anecdotes est invalide.' };
  }
  const facts = [];
  const seen = new Set();
  const resourcesById = new Map(resources.map(resource => [resource.id, resource]));
  for (const fact of document.facts) {
    if (!isRecord(fact) || !isId(fact.id) || !text(fact.text) || !text(fact.theme) || !text(fact.source)) {
      warnings.push('Une anecdote sans identifiant, texte, thématique ou source a été ignorée.');
      continue;
    }
    if (seen.has(fact.id)) {
      warnings.push(`L’anecdote « ${fact.id} » est présente plusieurs fois ; le doublon a été ignoré.`);
      continue;
    }
    seen.add(fact.id);
    const url = fact.url ? referenceUrl(fact.url) : null;
    if (fact.url && !url) warnings.push(`Anecdote ${fact.id} : l’URL de référence invalide a été ignorée.`);
    const lesson = fact.lessonId && lessonsById.get(fact.lessonId);
    const resource = fact.resourceId && resourcesById.get(fact.resourceId);
    if (fact.lessonId && !lesson) warnings.push(`Anecdote ${fact.id} : le cours associé est inconnu.`);
    if (fact.resourceId && !resource) warnings.push(`Anecdote ${fact.id} : la ressource associée est inconnue ou indisponible.`);
    facts.push({ id: fact.id, text: text(fact.text), theme: text(fact.theme), source: text(fact.source), url,
      lessonId: lesson ? lesson.id : null, resourceId: resource ? resource.id : null,
      resourceTitle: resource ? resource.title : null });
  }
  return { facts, warnings, error: facts.length ? null : 'La banque d’anecdotes ne contient aucune entrée valide.' };
}

async function fetchFacts() {
  try {
    const response = await fetch(new URL('./daily-facts.json', import.meta.url), { cache: 'no-cache' });
    if (!response.ok) throw new Error('daily-facts-unavailable');
    const data = await response.json();
    // The optional library association never controls the daily rotation.
    const needsResources = Array.isArray(data?.facts) && data.facts.some(fact => fact?.resourceId);
    const catalog = needsResources ? await loadResourceCatalog() : { resources: [] };
    return normalizeDailyFacts(data, catalog.resources);
  } catch {
    return { facts: [], warnings: [], error: 'La banque d’anecdotes est indisponible.' };
  }
}

function readDismissedDay(day) {
  // A refused write may coexist with a readable old value (quota/private mode).
  if (dismissedInMemory === day) return dismissedInMemory;
  try { return localStorage.getItem(DAILY_FACT_STORAGE_KEY); }
  catch { return dismissedInMemory; }
}

function dismissDay(day) {
  dismissedInMemory = day;
  // Only this feature's key is written. No progress/preference data is removed.
  try { localStorage.setItem(DAILY_FACT_STORAGE_KEY, day); } catch { /* Keep the in-page choice. */ }
}

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function makeLink(label, href, external = false) {
  const link = element('a', 'daily-fact-link', label);
  link.href = href;
  if (external) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(element('span', 'sr-only', ' (nouvel onglet)'));
  }
  return link;
}

function leafIcon() {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({ width: '21', height: '21', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) icon.setAttribute(key, value);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M20 4c-8-1-15 2-15 9a6 6 0 0 0 6 6c7 0 10-7 9-15ZM4 21l11-11');
  icon.append(path);
  return icon;
}

/**
 * Hydrate the section supplied by the app. On home it follows exam preparation;
 * on other pages it precedes page content. Returns an optional cleanup callback.
 */
export async function initDailyFact(root) {
  if (!(root instanceof Element)) return () => {};
  controllers.get(root)?.abort();
  const controller = new AbortController();
  controllers.set(root, controller);
  const { signal } = controller;
  root.classList.add('daily-fact');
  root.setAttribute('aria-label', 'Tu savais que… ?');
  root.hidden = true;
  const data = await (factsPromise ??= fetchFacts());
  if (signal.aborted) return () => {};
  if (data.error || data.warnings.length) console.warn('[Anecdote quotidienne]', data.error || data.warnings.join(' '));
  if (!data.facts.length) return () => controller.abort();
  let displayedDay;

  function render() {
    if (signal.aborted) return;
    const day = getParisDay();
    const hidden = readDismissedDay(day) === day;
    if (day === displayedDay) { root.hidden = hidden; return; }
    displayedDay = day;
    const fact = selectDailyFact(data.facts, day);
    const icon = element('span', 'daily-fact-icon');
    icon.append(leafIcon());
    const content = element('div', 'daily-fact-content');
    const heading = element('div', 'daily-fact-heading');
    heading.append(element('h2', '', 'Tu savais que… ?'), element('span', 'daily-fact-theme', fact.theme));
    const details = element('div', 'daily-fact-details');
    details.append(element('span', 'daily-fact-source', `Source : ${fact.source}`));
    if (fact.url) details.append(makeLink('En savoir plus ↗', fact.url, true));
    if (fact.lessonId) details.append(makeLink('Voir le cours', `cours.html?id=${encodeURIComponent(fact.lessonId)}`));
    if (fact.resourceId) details.append(makeLink('Voir la ressource', `ressources.html?query=${encodeURIComponent(fact.resourceTitle)}`));
    content.append(heading, element('p', 'daily-fact-text', fact.text), details);
    const close = element('button', 'daily-fact-dismiss', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Masquer l’anecdote pour aujourd’hui');
    close.title = 'Masquer pour aujourd’hui';
    close.addEventListener('click', () => {
      if (getParisDay() !== displayedDay) { render(); return; }
      const hadFocus = document.activeElement === close;
      dismissDay(displayedDay);
      root.hidden = true;
      if (hadFocus) (root.closest('main') || document.getElementById('app-main'))?.focus({ preventScroll: true });
    });
    root.replaceChildren(icon, content, close);
    root.dataset.factId = fact.id;
    root.dataset.factDate = day;
    root.hidden = hidden;
  }

  render();
  // Timers can be suspended in background tabs; refresh on return as well.
  const interval = window.setInterval(() => { if (!document.hidden) render(); }, 60000);
  signal.addEventListener('abort', () => window.clearInterval(interval), { once: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); }, { signal });
  window.addEventListener('pageshow', render, { signal });
  window.addEventListener('storage', event => {
    if (event.key === DAILY_FACT_STORAGE_KEY || event.key === null) render();
  }, { signal });
  return () => controller.abort();
}
