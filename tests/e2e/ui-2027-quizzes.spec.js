import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { lessons } from '../../assets/content.js';
import { capture, textContrasts } from '../helpers/ui-review.js';
import { accounts, createCourseQuizAPI } from './course-quiz-api.js';

const prefix = '/mon-bprea/';
const lesson = lessons[0], quiz = `${prefix}exercices.html?id=${lesson.id}`;
const key = 'bprea-demo-progress-v1';
async function open(page, url = quiz) {
  await page.goto(url);
  await expect(page.locator('#quiz-answer-count')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function fill(page, score = 2) {
  for (const [i, q] of lesson.quiz.entries()) await page.locator(`input[name="q${i}"][value="${i < score ? q.answer : (q.answer + 1) % q.options.length}"]`).check();
}
const noOverflow = async page => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(page.viewportSize().width);
  const overflowing = await page.locator('.quiz-aside,.quiz-best-card,.quiz-advice,.quiz-result-box p').evaluateAll(nodes => nodes.filter(n => n.scrollWidth > n.clientWidth + 1).map(n => ({ class: n.className, text: n.textContent.slice(0, 60) })));
  expect(overflowing).toEqual([]);
};
const synced = page => expect(page.locator('#course-quiz-sync-status')).toHaveText('Synchronisé');
async function personal(page) { const api = createCourseQuizAPI(); await api.install(page.context(), 'A', null, prefix); return api; }

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-16T15:00:00Z') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness: 'light' })));
  await page.route('**/*', route => ['127.0.0.1', 'course-quiz.invalid'].includes(new URL(route.request().url()).hostname) ? route.fallback() : route.abort());
});

test('QCM : sélection native, saisie, correction exacte et reset sans écriture', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('QCM du cours');
  await expect(page.locator('.quiz-course-title')).toHaveText(lesson.title);
  await expect(page.locator('#quiz-questions fieldset')).toHaveCount(lesson.quiz.length);
  await expect(page.locator('#check-quiz')).toBeDisabled();
  await expect(page.locator('#quiz-best-detail')).toContainText('Aucun score');
  await expect(page.locator('#quiz-history')).toContainText('Aucune tentative');
  const first = page.locator('input[name="q0"]').first();
  await first.focus(); await page.keyboard.press('ArrowDown');
  await expect(page.locator('input[name="q0"]').nth(1)).toBeChecked();
  await expect(page.locator('#quiz-answer-count')).toHaveText('1 réponse sur 3 renseignée');
  await page.locator('[data-question="0"] .option').last().click({ position: { x: 5, y: 10 } });
  await expect(page.locator('input[name="q0"]').last()).toBeChecked();
  await expect(page.locator('#quiz-answer-progress')).toHaveAttribute('value', '1');
  await expect(page.locator('.correct,.incorrect,.explanation:visible,.option-verdict:visible')).toHaveCount(0);
  await fill(page);
  await expect(page.locator('#quiz-answer-count')).toHaveText('3 réponses sur 3 renseignées');
  await expect(page.locator('#check-quiz')).toBeEnabled();
  await page.locator('#check-quiz').press('Enter');
  await expect(page.locator('#quiz-result-title')).toHaveText('2 / 3 bonnes réponses');
  await expect(page.locator('#quiz-result')).toBeFocused();
  await expect(page.locator('#quiz-result')).toHaveAccessibleName('2 / 3 bonnes réponses');
  await expect(page.locator('#quiz-save-status')).toContainText('Mode visiteur : sauvegarde locale uniquement.');
  await expect(page.locator('#quiz-result')).not.toContainText('cours a été');
  await expect(page.locator('.option.correct')).toHaveCount(3);
  await expect(page.locator('.option.incorrect')).toHaveCount(1);
  for (const [i, q] of lesson.quiz.entries()) {
    await expect(page.locator(`#explain-${i}`)).toContainText(q.why);
    await expect(page.locator(`#explain-${i}`)).toContainText(`Bonne réponse : ${q.options[q.answer]}`);
  }
  await expect(page.locator('[data-question="2"] .incorrect .option-verdict')).toHaveText('Ta réponse · Incorrecte');
  await expect(page.locator('#quiz-history li')).toHaveCount(1);
  const raw = await page.evaluate(key => localStorage.getItem(key), key);
  await page.locator('#retry-quiz').click();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
  await expect(first).toBeFocused();
  await expect(page.locator('#quiz-result')).toBeEmpty();
  await expect(page.locator('#quiz-answer-progress')).toHaveAttribute('value', '0');
  await expect(page.locator('.correct,.incorrect,.explanation:visible')).toHaveCount(0);
  await expect(page.locator('#quiz-history li')).toHaveCount(1);
  await expect(page.locator('#quiz-best-score')).toHaveText('2');
});

test('QCM : calcul visible pendant écriture, attente réseau puis confirmation distante réelle du service', async ({ page }) => {
  const api = await personal(page); await open(page); await synced(page);
  await page.evaluate(async () => {
    const service = await (await import('/mon-bprea/assets/course-quiz-service.js?v=e2e-lot5-1')).getCourseQuizService();
    const record = service.recordQuiz;
    service.recordQuiz = async (...args) => { await new Promise(resolve => { window.releaseQuizSave = resolve; }); return record(...args); };
  });
  api.restOffline = true;
  await fill(page); await page.locator('#check-quiz').click();
  await expect(page.locator('#quiz-save-status')).toHaveText('Enregistrement sur cet appareil…');
  await expect(page.locator('#quiz-result-title')).toHaveText('2 / 3 bonnes réponses');
  await expect(page.locator('#retry-quiz')).toBeDisabled();
  await expect(page.locator('#quiz-history li')).toHaveCount(0);
  await page.evaluate(() => window.releaseQuizSave());
  await expect(page.locator('#quiz-save-status')).toContainText('Progression enregistrée sur cet appareil.');
  await expect(page.locator('#quiz-save-status')).toContainText('en attente');
  await expect(page.locator('#quiz-save-status')).not.toContainText('confirmée');
  await expect(page.locator('#quiz-history li')).toHaveCount(1);
  api.restOffline = false;
  await page.evaluate(async () => (await (await import('/mon-bprea/assets/course-quiz-service.js?v=e2e-lot5-1')).getCourseQuizService()).retry());
  await expect(page.locator('#quiz-save-status')).toContainText('Synchronisation vers le compte confirmée.');
  expect(api.attempts.size).toBe(1);
});

test('QCM : refus IndexedDB, score et date conservés, retry unique', async ({ page }, info) => {
  const api = await personal(page);
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) {
      if (window.quizStorageFull && this.transaction.db.name === 'mon-bprea-course-quiz-personal-v1') throw new DOMException('Stockage fictif plein', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  await open(page); await synced(page);
  await page.evaluate(async () => {
    const service = await (await import('/mon-bprea/assets/course-quiz-service.js?v=e2e-lot5-1')).getCourseQuizService();
    const record = service.recordQuiz;
    service.recordQuiz = (...args) => { window.attemptedQuizAt = args[1].completedAt; return record(...args); };
  });
  await page.evaluate(() => window.quizStorageFull = true);
  await fill(page, 3); await page.locator('#check-quiz').click();
  await expect(page.locator('#quiz-save-error')).toContainText('Erreur de sauvegarde');
  await expect(page.locator('#quiz-result-title')).toHaveText('3 / 3 bonnes réponses');
  await expect(page.locator('#quiz-save-status')).toBeEmpty();
  await expect(page.locator('#quiz-questions input:checked')).toHaveCount(3);
  await expect(page.locator('.explanation:visible')).toHaveCount(3);
  await expect(page.locator('#quiz-history li')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await capture(page, 'quiz-save-error-desktop.png', info);
  const correctedAt = await page.evaluate(() => window.attemptedQuizAt);
  await page.clock.runFor(60000);
  await page.evaluate(() => window.quizStorageFull = false);
  await page.locator('#retry-quiz-save').click();
  await synced(page);
  await expect(page.locator('#quiz-history li')).toHaveCount(1);
  expect(api.attempts.size).toBe(1);
  expect([...api.attempts.values()][0].completed_at).toBe(correctedAt);
  await expect(page.locator('#quiz-save-status')).toContainText('Progression enregistrée');
});

test('QCM : ancienne sauvegarde asynchrone de A ignorée dans B', async ({ page }) => {
  const api = await personal(page); await open(page); await synced(page);
  await page.evaluate(async () => {
    const service = await (await import('/mon-bprea/assets/course-quiz-service.js?v=e2e-lot5-1')).getCourseQuizService();
    const record = service.recordQuiz;
    service.recordQuiz = async (...args) => {
      const result = await record(...args); window.quizCommitted = true;
      await new Promise(resolve => { window.releaseOldQuiz = resolve; }); return result;
    };
  });
  await fill(page, 3); await page.locator('#check-quiz').click();
  await page.waitForFunction(() => window.quizCommitted);
  await expect(page.locator('#retry-quiz')).toBeDisabled();
  await page.evaluate(async email => {
    const auth = await (await import('/mon-bprea/assets/auth-service.js?v=e2e-lot5-1')).getAuthService();
    await auth.signOut(); await auth.signIn(email, 'synthetic-password');
  }, accounts.B.email);
  await synced(page);
  await expect(page.locator('#quiz-result')).toBeEmpty();
  await expect(page.locator('#quiz-questions input:checked')).toHaveCount(0);
  await page.evaluate(() => window.releaseOldQuiz());
  await expect(page.locator('#quiz-result')).toBeEmpty();
  await expect(page.locator('#quiz-history li')).toHaveCount(0);
  await expect(page.locator('#quiz-best-score')).toHaveText('—');
  await expect(page.locator('input[name="q0"]').first()).toBeEnabled();
  expect([...api.attempts.values()].filter(row => row.user_id === accounts.B.id)).toHaveLength(0);
});

test('QCM : stockage inaccessible et score inconnu explicites, aucune écriture', async ({ page }, info) => {
  await page.addInitScript(key => {
    localStorage.setItem(key, '{source fictive conservée');
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function(name) {
      if (name === key) throw new DOMException('Refus synthétique', 'SecurityError');
      return get.call(this, name);
    };
    window.originalStorageGet = get;
  }, key);
  await open(page);
  await expect(page.locator('#quiz-best-score')).toHaveText('—');
  await expect(page.locator('#quiz-best-detail')).toContainText('indisponible');
  await expect(page.locator('#quiz-history')).toContainText('Historique indisponible');
  await expect(page.locator('#check-quiz')).toBeDisabled();
  await expect(page.locator('#quiz-questions input:enabled')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await capture(page, 'quiz-unavailable-desktop.png', info);
  expect(await page.evaluate(key => window.originalStorageGet.call(localStorage, key), key)).toBe('{source fictive conservée');
});

test('QCM : écriture visiteur refusée puis reprise de la même correction', async ({ page }) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name, value) {
      if (window.refuseQuizWrite && name === 'bprea-demo-progress-v1') throw new DOMException('Refus synthétique', 'QuotaExceededError');
      return set.call(this, name, value);
    };
  });
  await open(page); await fill(page);
  await page.evaluate(() => window.refuseQuizWrite = true);
  await page.locator('#check-quiz').click();
  await expect(page.locator('#quiz-save-error')).toContainText('Erreur de sauvegarde');
  await expect(page.locator('#quiz-result-title')).toHaveText('2 / 3 bonnes réponses');
  await expect(page.locator('.explanation:visible')).toHaveCount(3);
  await expect(page.locator('#quiz-history li')).toHaveCount(0);
  await page.evaluate(() => window.refuseQuizWrite = false);
  await page.locator('#retry-quiz-save').click();
  await expect(page.locator('#quiz-save-status')).toContainText('sauvegarde locale uniquement');
  await expect(page.locator('#quiz-history li')).toHaveCount(1);
  expect(JSON.parse(await page.evaluate(key => localStorage.getItem(key), key))[lesson.id].quizAttempts).toHaveLength(1);
});

test('QCM : héritage non daté, ordre, dates et tentatives identiques conservés', async ({ page }) => {
  const attempts = [
    { score: 1, total: 3, completedAt: '2026-11-15T10:00:00Z' },
    { score: 1, total: 3, completedAt: '2026-11-15T10:00:00Z' },
    { score: 2, total: 3, completedAt: '2026-11-14T09:00:00Z' },
    { score: 0, total: 3, completedAt: 'date-invalide' },
  ];
  await page.addInitScript(({ key, id, attempts }) => localStorage.setItem(key, JSON.stringify({ [id]: { score: 3, quizAttempts: attempts } })), { key, id: lesson.id, attempts });
  await open(page);
  await expect(page.locator('#quiz-best-score')).toHaveText('3');
  await expect(page.locator('#quiz-history li')).toHaveCount(3);
  await expect(page.locator('#quiz-history strong')).toHaveText(['1 / 3', '1 / 3', '2 / 3']);
  expect(await page.locator('#quiz-history time').evaluateAll(nodes => nodes.map(n => n.dateTime))).toEqual(attempts.slice(0, 3).map(a => a.completedAt));
});

test('QCM : cinq largeurs, longues propositions, nombreuses questions et texte à 200 %', async ({ page }) => {
  await page.route('**/assets/content.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nlessons[0].quiz = Array.from({length:12}, (_, i) => ({...lessons[0].quiz[i % 3], options: lessons[0].quiz[i % 3].options.map(o => o + ' — proposition synthétique longue à vérifier sur petit écran ' + 'x'.repeat(70))}));` });
  });
  await open(page);
  await expect(page.locator('#quiz-questions fieldset')).toHaveCount(12);
  for (const large of [false, true]) {
    if (large) await page.addStyleTag({ content: 'html{font-size:200%!important}' });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await noOverflow(page);
      if (width === 320) expect(await page.locator('.option').first().evaluate(n => n.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    }
  }
  await page.setViewportSize({ width: 1024, height: 1000 });
  await page.addStyleTag({ content: 'body,h1,h2,h3,legend{font-family:Arial,sans-serif!important}' });
  await noOverflow(page);
});

test('QCM : contrastes des huit palettes et états, clavier, préférences', async ({ page }, info) => {
  await open(page); const report = [];
  await page.locator('input[name="q0"]').first().check();
  for (const corrected of [false, true]) {
    if (corrected) { await fill(page); await page.locator('#check-quiz').click(); await expect(page.locator('#quiz-save-status')).toContainText('Progression enregistrée'); }
    for (const season of ['spring', 'summer', 'autumn', 'winter']) for (const theme of ['light', 'dark']) {
      await page.evaluate(({ season, theme }) => { document.documentElement.dataset.season = season; document.documentElement.dataset.theme = theme; }, { season, theme });
      const rows = await textContrasts(page.locator('.quiz-cover :is(h1,p,a),.quiz-layout :is(legend,.option-copy,.option-letter,.option-verdict:not([hidden]),.explanation:not([hidden]) p,.quiz-save p:not([hidden]),.btn:not([hidden]),#quiz-check-hint)'));
      for (const row of rows) expect(row.ratio, `${season}/${theme}/${corrected}: ${row.text}`).toBeGreaterThanOrEqual(4.5);
      const controls = await page.locator('.option').first().evaluate(node => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const light = color => {
          ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        };
        const style = getComputedStyle(node), bg = light(style.backgroundColor);
        const ratio = color => { const value = light(color); return (Math.max(bg, value) + .05) / (Math.min(bg, value) + .05); };
        return { border: ratio(style.borderTopColor), focus: ratio(style.getPropertyValue('--color-focus')) };
      });
      expect(controls.border, `${season}/${theme}/${corrected} border`).toBeGreaterThanOrEqual(3);
      expect(controls.focus, `${season}/${theme}/${corrected} focus`).toBeGreaterThanOrEqual(3);
      if (corrected) {
        // A selected correct/incorrect answer must stop using the selection tint.
        const colors = await page.locator('.option.correct:has(input:checked),.option.incorrect:has(input:checked)').evaluateAll(nodes => nodes.map(node => {
          const probe = document.createElement('span');
          probe.style.backgroundColor = `var(--color-${node.classList.contains('correct') ? 'success' : 'error'}-bg)`;
          node.append(probe); const expected = getComputedStyle(probe).backgroundColor; probe.remove();
          return { actual: getComputedStyle(node).backgroundColor, expected };
        }));
        for (const color of colors) expect(color.actual).toBe(color.expected);
      }
      report.push({ season, theme, corrected, minimum: Math.min(...rows.map(r => r.ratio)), controls });
    }
  }
  await page.locator('#retry-quiz').click();
  await expect(page.locator('input[name="q0"]').first()).toBeFocused();
  expect(await page.locator('.option').first().evaluate(n => getComputedStyle(n).outlineStyle)).toBe('solid');
  await page.emulateMedia({ forcedColors: 'active' });
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('input[name="q0"]').nth(1)).toBeChecked();
  await capture(page.locator('[data-question="0"]'), 'quiz-forced-colors.png', info);
  await page.emulateMedia({ forcedColors: 'none' });
  await page.addStyleTag({ content: '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' });
  await page.setViewportSize({ width: 320, height: 1000 }); await noOverflow(page);
  expect(await page.locator('.option').first().evaluate(n => getComputedStyle(n).transitionDuration)).toBe('0s');
  await fill(page); await page.locator('#check-quiz').click();
  await expect(page.locator('#quiz-save-status')).toContainText('Progression enregistrée');
  await page.addStyleTag({ content: 'html{font-size:200%!important}' });
  for (const width of [320, 390, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 1000 }); await noOverflow(page); }
  await page.setViewportSize({ width: 320, height: 1000 });
  await capture(page.locator('#quiz-result'), 'quiz-result-200-dark.png', info);
  const path = info.outputPath('quiz-contrasts.json'); await writeFile(path, JSON.stringify(report, null, 2));
  await info.attach('quiz-contrasts', { path, contentType: 'application/json' });
});

test('QCM : galerie des états et thèmes pour revue humaine', async ({ page }, info) => {
  const names = [];
  const shot = async (name, target = page) => { await capture(target, name, info); names.push(name); };
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await open(page);
    await shot(`quiz-blank-${width}.png`);
    await page.locator('input[name="q0"]').first().check(); await shot(`quiz-selected-${width}.png`);
    await fill(page); await shot(`quiz-ready-${width}.png`);
    await page.locator('#check-quiz').click(); await expect(page.locator('#quiz-save-status')).toContainText('Progression enregistrée');
    await shot(`quiz-corrected-${width}.png`);
    await shot(`quiz-result-${width}.png`, page.locator('#quiz-result'));
    await shot(`quiz-history-${width}.png`, page.locator('.quiz-history-panel'));
    if (width === 1440) {
      await shot('quiz-good-answer.png', page.locator('[data-question="0"]'));
      await shot('quiz-wrong-answer.png', page.locator('[data-question="2"]'));
    }
    await page.locator('#theme-toggle').click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await shot(`quiz-dark-${width}.png`);
    await page.evaluate(() => document.documentElement.dataset.season = 'winter'); await shot(`quiz-winter-dark-${width}.png`);
  }
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 1000 }); await open(page);
    await shot(`quiz-blank-${width}.png`);
  }
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Revue QCM PR3 lot 2</title><style>body{font:16px/1.6 system-ui;background:#faf7f0;color:#342f28;margin:24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}figure{margin:0}img{width:100%;height:auto}a{color:#954a32}</style><h1>QCM de cours · états à revoir</h1><p>Automne clair, sombre et hiver sombre ; visiteur isolé, 16 novembre 2026, même taille de viewport dans chaque série. Images de revue sans approbation automatique. Comparaison à main 456e844 dans l’artefact de performance.</p><div class="grid">${names.map(n => `<figure><figcaption>${n}</figcaption><a href="${n}"><img src="${n}" alt="${n}" loading="lazy"></a></figure>`).join('')}</div></html>`;
  const path = info.outputPath('revue-qcm.html'); await writeFile(path, html); await info.attach('revue-qcm', { path, contentType: 'text/html' });
});
