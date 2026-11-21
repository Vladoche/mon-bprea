import { test, expect } from '@playwright/test';
import { units, lessons } from '../../assets/content.js';
import { accounts, createCourseQuizAPI } from './course-quiz-api.js';
import { capture, textContrasts } from '../helpers/ui-review.js';

const prefix = '/mon-bprea/';
const instant = new Date('2026-11-15T11:00:00Z');
const progressKey = 'bprea-demo-progress-v1';
const unitProgress = page => page.locator('[data-unit-progress-label="uc3"]');
const synced = page => expect(page.locator('#course-quiz-sync-status')).toHaveText('Synchronisé');

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: instant });
  await page.addInitScript(() => localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness: 'light' })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('accueil : trois vrais cours, actions distinctes et captures clair/sombre', async ({ page }, testInfo) => {
  const requests = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.goto(prefix);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ton espace de révision pour le BPREA');
  await expect(page.getByRole('link', { name: 'Commencer à réviser' })).toHaveAttribute('href', 's-exercer.html');
  await expect(page.getByRole('link', { name: 'Explorer les cours', exact: true })).toHaveAttribute('href', 'mes-cours.html');
  const cards = page.locator('.home-course-card');
  await expect(cards).toHaveCount(3);
  for (const [index, lesson] of lessons.slice(0, 3).entries()) {
    await expect(cards.nth(index)).toContainText(lesson.title);
    await expect(cards.nth(index)).toHaveAttribute('href', `cours.html?id=${lesson.id}`);
    await expect(cards.nth(index)).toContainText(`${lesson.quiz.length} questions`);
    await expect(cards.nth(index)).toContainText('À découvrir');
  }
  await expect(page.locator('[data-unit-percent="uc3"]')).toHaveText('0 % des cours terminés');
  await expect(page.locator('#exam-preparation, .daily-fact, .course-quiz-panel')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Productions animales');
  expect(requests.some(path => /daily-fact|exam-preparation|calendar-events/.test(path))).toBe(false);
  for (const file of ['auth-pages.js', 'botanical.js', 'calendar.js', 'dashboard.js', 'drill.js', 'resource-library.js']) {
    expect(requests).not.toContain(`${prefix}assets/${file}`);
  }
  expect(await page.locator('.home-garden img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  for (const [width, device] of [[1440, 'desktop'], [390, 'mobile']]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const brightness of ['light', 'dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== brightness) await page.locator('#theme-toggle').click();
      await capture(page, `pr2-home-${device}-${brightness}.png`, testInfo);
    }
  }
  await page.keyboard.press('Tab'); await cards.first().focus();
  expect(await cards.first().evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/mon-bprea\/cours\.html\?id=matiere-organique$/);
});

test('un module de rubrique indisponible laisse la navigation et permet de recharger', async ({ page }) => {
  let fail = true;
  await page.route('**/assets/calendar.js*', route => fail ? route.abort() : route.continue());
  await page.goto(`${prefix}calendrier.html`);
  await expect(page.locator('main [role="alert"]')).toContainText('Recharge la page pour réessayer.');
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  fail = false;
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Calendrier de formation', exact: true })).toBeVisible();
});

test('Mes cours : sept UC exactes, progression réelle, anecdote unique et source conservée', async ({ page }, testInfo) => {
  const raw = JSON.stringify({ 'matiere-organique': { done: true, score: 2 } });
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key: progressKey, raw });
  await page.goto(prefix + 'mes-cours.html');
  const cards = page.locator('.hub-unit-card');
  await expect(cards).toHaveCount(7);
  for (const [index, unit] of units.entries()) {
    const count = lessons.filter(lesson => lesson.unit === unit.id).length;
    await expect(cards.nth(index)).toHaveAttribute('href', `uc.html?id=${unit.id}`);
    await expect(cards.nth(index).getByRole('heading')).toHaveText(unit.title);
    await expect(cards.nth(index)).toContainText(`${count} cours disponible`);
    if (!count) {
      await expect(cards.nth(index)).toContainText('À venir');
      await expect(cards.nth(index).locator('progress')).toHaveCount(0);
    }
  }
  await expect(unitProgress(page)).toHaveText('1 / 4 cours terminés · 25 %');
  await expect(page.locator('[data-unit-progress="uc3"]')).toHaveJSProperty('value', 25);
  await expect(page.locator('[data-learning-source]')).toHaveText('Progression locale sur cet appareil');
  const fact = page.getByRole('region', { name: 'Tu savais que… ?' });
  await expect(fact).toHaveCount(1);
  await expect(fact).toBeVisible();
  await expect(fact.locator('.daily-fact-source')).toContainText('Source :');
  await expect(fact.getByRole('link', { name: /En savoir plus/ })).toHaveAttribute('href', /^https:\/\//);
  expect(await fact.evaluate(node => node.closest('main') && node.previousElementSibling.classList.contains('hub-unit-section'))).toBe(true);
  for (const [width, device] of [[1440, 'desktop'], [390, 'mobile']]) {
    await page.setViewportSize({ width, height: 1000 });
    await capture(page, `pr2-courses-${device}-light.png`, testInfo);
  }
  await capture(fact, 'pr2-courses-fact.png', testInfo);
  await fact.getByRole('button', { name: 'Masquer l’anecdote sur cette page' }).press('Enter');
  await expect(fact).toBeHidden();
  await expect(page.locator('main')).toBeFocused();
  await page.clock.setSystemTime(new Date('2026-11-15T22:59:30Z'));
  await page.clock.fastForward(60000);
  await expect(fact).toHaveAttribute('data-fact-date', '2026-11-16');
  await expect(fact).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), progressKey)).toBe(raw);
});

test('progression inconnue : stockage bloqué et banque malformée ne bloquent pas les cours', async ({ page }, testInfo) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Synthetic unavailable storage', 'SecurityError'); } }));
  await page.route('**/assets/daily-facts.json*', route => route.fulfill({ json: { version: 999, facts: [] } }));
  await page.goto(prefix + 'mes-cours.html');
  await expect(page.locator('.hub-unit-card')).toHaveCount(7);
  await expect(unitProgress(page)).toContainText('Progression indisponible');
  await expect(unitProgress(page)).not.toContainText('0 %');
  await expect(page.locator('[data-unit-progress="uc3"]')).toBeHidden();
  await expect(page.locator('.daily-fact')).toBeHidden();
  await capture(page, 'pr2-progress-unavailable.png', testInfo);
  await page.locator('[data-learning-unit="uc3"]').click();
  await expect(page.locator('.lesson-row')).toHaveCount(lessons.length);
});

test('compte A/B : reprise datée, cache hors ligne et historique visiteur préservé', async ({ page }) => {
  const raw = JSON.stringify(Object.fromEntries(lessons.map(lesson => [lesson.id, { done: true }])));
  const api = createCourseQuizAPI(); await api.install(page.context(), 'A', raw, prefix);
  await page.goto(prefix + 'cours.html?id=rapport-cn'); await synced(page);
  await page.locator('#mark-done').check(); await synced(page);
  await page.goto(prefix + 'exercices.html?id=rapport-cn'); await synced(page);
  const lesson = lessons.find(item => item.id === 'rapport-cn');
  for (const [index, question] of lesson.quiz.entries()) await page.locator(`input[name="q${index}"][value="${question.answer}"]`).check();
  await page.locator('#check-quiz').click(); await synced(page);
  await page.goto(prefix); await synced(page);
  await expect(page.getByRole('link', { name: 'Reprendre mes révisions' })).toHaveAttribute('href', 'cours.html?id=rapport-cn');
  await expect(page.locator('[data-unit-percent="uc3"]')).toHaveText('25 % des cours terminés');
  await page.goto(prefix + 'mes-cours.html'); await synced(page);
  await expect(unitProgress(page)).toContainText('25 %');
  api.authOffline = true; api.restOffline = true;
  await page.reload();
  await expect(unitProgress(page)).toContainText('25 %');
  await expect(page.locator('.course-quiz-notice')).toBeVisible();
  api.authOffline = false; api.restOffline = false;
  await page.evaluate(async email => { const app = new URL(document.querySelector('script[type="module"][src]').src); const url = new URL('./auth-service.js', app); url.search = app.search; const auth = await (await import(url.href)).getAuthService(); await auth.signOut(); await auth.signIn(email, 'synthetic-password'); }, accounts.B.email);
  await synced(page);
  await expect(unitProgress(page)).toContainText('0 %');
  await expect(page.locator('[data-course-resume-label]')).toHaveText('Découvrir ce cours');
  await page.evaluate(async email => { const app = new URL(document.querySelector('script[type="module"][src]').src); const url = new URL('./auth-service.js', app); url.search = app.search; const auth = await (await import(url.href)).getAuthService(); await auth.signOut(); await auth.signIn(email, 'synthetic-password'); }, accounts.A.email);
  await synced(page); await expect(unitProgress(page)).toContainText('25 %');
  await expect(page.locator('[data-course-resume-label]')).toHaveText('Reprendre ce cours');
  expect(await page.evaluate(key => localStorage.getItem(key), progressKey)).toBe(raw);
});

test('profil : paramètres, assistance et aucun panneau de synchronisation', async ({ page }, testInfo) => {
  const api = createCourseQuizAPI(); await api.install(page.context(), 'A', null, prefix);
  await page.goto(prefix + 'profil.html#parametres');
  const settings = page.locator('#parametres');
  await expect(page.locator('#donnees-synchronisation, [data-course-quiz-settings]')).toHaveCount(0);
  await settings.getByRole('button', { name: 'Régler l’apparence' }).click();
  await expect(page.locator('#appearance-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(settings.getByRole('button', { name: 'Régler l’apparence' })).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await capture(settings, 'profil-parametres.png', testInfo);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Profil ${width}px`).toBe(true);
  }
  await page.addStyleTag({ content: 'html { font-size:200% !important; }' });
  await page.setViewportSize({ width: 320, height: 1000 });
  const profileReflow = await page.evaluate(() => ({ width: innerWidth, total: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll('main *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).map(node => ({ tag: node.tagName, class: node.className, text: node.textContent.slice(0, 80), width: node.getBoundingClientRect().width })).slice(0, 10) }));
  expect(profileReflow.total, JSON.stringify(profileReflow)).toBeLessThanOrEqual(profileReflow.width);
  expect(await settings.getByRole('button').evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(26);
  for (const file of ['index.html', 'mes-cours.html', 'uc.html?id=uc3', 'cours.html?id=matiere-organique', 'exercices.html?id=matiere-organique']) {
    await page.goto(prefix + file); await synced(page);
    await expect(page.locator('.course-quiz-panel, .course-quiz-actions')).toHaveCount(0);
    await expect(page.locator('.course-quiz-notice')).toBeHidden();
  }
});

test('échec de sauvegarde : message contextuel, données conservées et lien d’assistance', async ({ page }, testInfo) => {
  const api = createCourseQuizAPI(); await api.install(page.context(), 'A', null, prefix);
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (window.fullLearningStorage && this.transaction.db.name === 'mon-bprea-course-quiz-personal-v1') throw new DOMException('Synthetic full storage', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  await page.goto(prefix + 'exercices.html?id=matiere-organique'); await synced(page);
  await page.evaluate(() => { window.fullLearningStorage = true; });
  for (const [index, question] of lessons[0].quiz.entries()) await page.locator(`input[name="q${index}"][value="${question.answer}"]`).check();
  await page.locator('#check-quiz').click();
  await expect(page.locator('#quiz-result [role="alert"]')).toContainText('Erreur de sauvegarde');
  await expect(page.locator('.course-quiz-notice')).toBeVisible();
  await expect(page.locator('.course-quiz-notice a')).toHaveAttribute('href', 'contact.html');
  await expect(page.locator('.course-quiz-panel')).toHaveCount(0);
  await expect(page.locator('#quiz-history li')).toHaveCount(0);
  expect(api.attempts.size).toBe(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await capture(page, 'pr2-save-error.png', testInfo);
  await page.evaluate(() => { window.fullLearningStorage = false; });
  await page.getByRole('button', { name: 'Réessayer l’enregistrement', exact: true }).click(); await synced(page);
  await expect(page.locator('#quiz-history li')).toHaveCount(1);
});

for (const [file, label] of [['s-exercer.html', 'practice'], ['outils.html', 'tools']]) test(`${label} : destinations réelles, états vides et captures`, async ({ page }, testInfo) => {
  const requests = []; page.on('request', request => requests.push(request.url()));
  await page.goto(prefix + file);
  const links = page.locator('main .hub-link-card');
  const hrefs = label === 'tools' ? ['itk.html', 'ressources.html', 'reconnaissance-plantes.html'] : ['drill.html', 'tableau-de-bord.html', 'calendrier.html'];
  await expect(links).toHaveCount(3);
  for (const [index, href] of hrefs.entries()) await expect(links.nth(index)).toHaveAttribute('href', href);
  if (label === 'practice') {
    await expect(page.locator('.hub-status')).toContainText('Aucune réponse validée cette semaine');
    await expect(page.locator('.hub-status h3')).not.toContainText('erreur');
    await expect(page.locator('.hub-weekly-metrics dd').last()).toHaveText('Aucune donnée');
    expect(await links.first().evaluate(node => node.closest('section').nextElementSibling.classList.contains('hub-weekly'))).toBe(true);
  }
  for (const [width, device] of [[1440, 'desktop'], [390, 'mobile']]) {
    await page.setViewportSize({ width, height: 1000 });
    await capture(page, `pr2-${label}-${device}.png`, testInfo);
  }
  expect(requests.some(url => /daily-fact/.test(url))).toBe(false);
  await links.first().press('Enter');
  await expect(page).toHaveURL(new RegExp(`/mon-bprea/${hrefs[0].replace('.', '\\.')}$`));
});

test('hubs accessibles : cinq largeurs, texte doublé, clavier, contrastes et préférences', async ({ page }, testInfo) => {
  const report = [];
  for (const file of ['index.html', 'mes-cours.html', 's-exercer.html', 'outils.html']) {
    await page.goto(prefix + file);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('main .home-course-card, main .hub-unit-card, main .hub-link-card').first()).toBeVisible();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${file}, ${width}px`).toBe(true);
    }
    for (const brightness of ['light', 'dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== brightness) await page.locator('#theme-toggle').click();
      const contrasts = await textContrasts(page.locator('main h1, main h2, main h3, main .btn, main .hub-card-action, main .learning-source, main .home-course-state, main .hub-availability'));
      for (const contrast of contrasts) expect(contrast.ratio, `${file} ${brightness}: ${contrast.text}`).toBeGreaterThanOrEqual(4.5);
      report.push({ file, brightness, contrasts });
    }
    await page.addStyleTag({ content: 'html { font-size:200% !important; } body,h1,h2,h3 { font-family:Verdana,sans-serif !important; }' });
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 1000 });
      const reflow = await page.evaluate(() => ({ width:innerWidth, total:document.documentElement.scrollWidth, overflow:[...document.querySelectorAll('main *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).map(node => `${node.tagName}.${node.className}`).slice(0, 8) }));
      expect(reflow.total, JSON.stringify({ file, ...reflow })).toBeLessThanOrEqual(width);
    }
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    const card = page.locator('main .home-course-card, main .hub-unit-card, main .hub-link-card').first();
    await page.keyboard.press('Tab'); await card.focus(); await expect(card).toBeFocused();
    expect(await card.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none');
    expect(await card.locator('button, input, a').count()).toBe(0);
    await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'reduce' });
  }
  await testInfo.attach('hubs-accessibility.json', { body: JSON.stringify({ scope: 'Targeted automated reflow, names, keyboard focus and composed text contrasts; not a complete WCAG audit', report }, null, 2), contentType: 'application/json' });
});
