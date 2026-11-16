import { test, expect } from '@playwright/test';
import { copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { lessons, units } from '../../assets/content.js';
import { capture, textContrasts } from '../helpers/ui-review.js';
import { accounts, createCourseQuizAPI } from './course-quiz-api.js';

const prefix = '/mon-bprea/';
const course = `${prefix}cours.html?id=matiere-organique`;
const appearanceKey = 'bprea-demo-appearance-device-v1';
async function scene(page, url = course) {
  await page.goto(url);
  await expect(page.locator('h1')).not.toHaveText('Chargement des cours et QCM');
  await expect(page.locator('.library-loading')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(page.viewportSize().width);
const synced = page => expect(page.locator('#course-quiz-sync-status')).toHaveText('Synchronisé');
async function personal(page) {
  const api = createCourseQuizAPI(); await api.install(page.context(), 'A', null, prefix);
  return api;
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-16T11:00:00Z') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(key => {
    localStorage.setItem(key, JSON.stringify({ version: 1, season: 'autumn', brightness: 'light' }));
  }, appearanceKey);
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return ['127.0.0.1', 'course-quiz.invalid'].includes(host) ? route.fallback() : route.abort();
  });
});

test('PR3 : sept UC/UCARE, vrais cours, chapitres, ressources et six états vides', async ({ page }) => {
  for (const unit of units) {
    await scene(page, `${prefix}uc.html?id=${unit.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(unit.title);
    const list = lessons.filter(l => l.unit === unit.id);
    await expect(page.locator('.lesson-row')).toHaveCount(list.length);
    await expect(page.locator('.unit-notice')).toContainText('Ce n’est pas un support officiel.');
    if (list.length) {
      for (const lesson of list) {
        const link = page.getByRole('link', { name: lesson.title, exact: true });
        await expect(link).toHaveAttribute('href', `cours.html?id=${lesson.id}`);
        await expect(link).toContainText(lesson.summary);
        await expect(link).toContainText(`${lesson.minutes} min de lecture`);
      }
      await expect(page.locator('[data-course-card-state]')).toHaveText(list.map(() => 'À découvrir'));
      await page.getByRole('navigation', { name: 'Sommaire des chapitres' }).getByRole('link').first().press('Enter');
      await expect(page.locator('.course-chapter')).toBeInViewport();
      await expect(page.locator('.course-chapter')).toBeFocused();
      await expect(page.locator('#unit-resources .library-card')).toHaveCount(3);
    } else {
      await expect(page.getByRole('heading', { name: 'Contenus à venir', exact: true })).toBeVisible();
      await expect(page.locator('.unit-layout progress')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Retour à Mes cours', exact: true })).toHaveAttribute('href', 'mes-cours.html');
      await expect(page.getByRole('link', { name: 'Découvrir l’UC 03', exact: true })).toHaveAttribute('href', 'uc.html?id=uc3');
    }
  }
});

test('PR3 : progression locale fiable et ouverture seule sans complétion', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bprea-demo-progress-v1', JSON.stringify({ 'rapport-cn': { done: true } })));
  await scene(page, `${prefix}uc.html?id=uc3`);
  await expect(page.locator('[data-unit-progress-label]')).toHaveText('1 / 4 cours terminés · 25 %');
  await expect(page.locator('[data-unit-progress]')).toHaveJSProperty('value', 25);
  await expect(page.locator('[data-course-card-state="rapport-cn"]')).toHaveText('Terminé');
  await page.getByRole('link', { name: lessons[0].title, exact: true }).click();
  await expect(page.locator('#mark-done')).not.toBeChecked();
  await page.goBack();
  await expect(page.locator('[data-unit-progress-label]')).toHaveText('1 / 4 cours terminés · 25 %');
});

test('PR3 : progression indisponible explicite et contrôle désactivé avec raison', async ({ page }) => {
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      if (key === 'bprea-demo-progress-v1') throw new DOMException('Stockage synthétique inaccessible', 'SecurityError');
      return getItem.call(this, key);
    };
  });
  await scene(page, `${prefix}uc.html?id=uc3`);
  await expect(page.locator('[data-unit-progress-label]')).toContainText('Progression indisponible');
  await expect(page.locator('[data-unit-progress]')).toBeHidden();
  await expect(page.locator('[data-course-card-state]')).toHaveText(lessons.map(() => 'Progression indisponible'));
  await scene(page);
  await expect(page.locator('#mark-done')).toBeDisabled();
  await expect(page.locator('#mark-done')).toHaveAttribute('aria-describedby', 'done-state');
  await expect(page.locator('#done-state')).toHaveText('Progression indisponible');
});

test('PR3 : un historique ambigu ne produit ni zéro certain ni fausse complétion', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bprea-demo-progress-v1', JSON.stringify({ 'matiere-organique': { done: 'illisible' } })));
  await scene(page, `${prefix}uc.html?id=uc3`);
  await expect(page.locator('[data-unit-progress-label]')).toContainText('Progression indisponible');
  await expect(page.locator('[data-course-card-state="matiere-organique"]')).toHaveText('Progression indisponible');
  await scene(page);
  await expect(page.locator('#mark-done')).not.toBeChecked();
  await expect(page.locator('#mark-done')).toBeDisabled();
  await expect(page.locator('#done-state')).toHaveText('Progression indisponible');
});

test('PR3 : quatre cours intacts, sommaires dérivés, ressources, QCM et ordre pédagogique', async ({ page }) => {
  for (const [index, lesson] of lessons.entries()) {
    await scene(page, `${prefix}cours.html?id=${lesson.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(lesson.title);
    await expect(page.locator('.learning-cover')).toContainText(lesson.summary);
    const original = await page.evaluate(body => {
      const template = document.createElement('template'); template.innerHTML = body;
      return { text: template.content.textContent, headings: [...template.content.querySelectorAll('h2,h3')].map(h => h.textContent) };
    }, lesson.body);
    expect(await page.locator('.reading-body').textContent()).toBe(original.text);
    await expect(page.locator('.reading-toc a')).toHaveText(original.headings);
    await expect(page.locator('.essentials li')).toHaveText(lesson.essentials);
    await expect(page.getByRole('link', { name: 'Faire le QCM', exact: true })).toHaveAttribute('href', `exercices.html?id=${lesson.id}`);
    await expect(page.locator('.finish-box')).toContainText(`${lesson.quiz.length} questions corrigées`);
    await expect(page.locator('.next-lesson')).toHaveAttribute('href', index < lessons.length - 1 ? `cours.html?id=${lessons[index + 1].id}` : 'uc.html?id=uc3');
    await expect(page.locator('#course-resources .library-associated-links')).toBeVisible();
    await expect(page.locator('.reading-table')).toHaveCount(1);
  }
  await scene(page);
  await expect(page.locator('#course-resources .library-card')).toHaveCount(1);
  await expect(page.locator('#course-resources a.library-open').first()).toHaveAttribute('href', 'documents/fiche-demo-matiere-organique.pdf');
  await page.getByRole('link', { name: 'Faire le QCM', exact: true }).click();
  await expect(page.locator('.question')).toHaveCount(lessons[0].quiz.length);
});

test('PR3 : ancres stables, clavier, focus et liens directs après rechargement', async ({ page }) => {
  await scene(page);
  const entries = page.locator('.reading-toc a'), ids = await page.locator('.reading-body h2').evaluateAll(nodes => nodes.map(n => n.id));
  for (const [index, id] of ids.entries()) {
    await entries.nth(index).focus(); await page.keyboard.press('Enter');
    await expect(page.locator(`[id="${id}"]`)).toBeFocused();
    await expect(page.locator(`[id="${id}"]`)).toBeInViewport();
    expect(await page.locator(`[id="${id}"]`).evaluate(n => n.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  }
  await page.reload(); await expect(page.locator(`[id="${ids.at(-1)}"]`)).toBeFocused();
  expect(await page.locator('.reading-body h2').evaluateAll(nodes => nodes.map(n => n.id))).toEqual(ids);
  await page.goBack(); await expect(page.locator(`[id="${ids.at(-2)}"]`)).toBeFocused();
  await page.locator('.reading-table').focus();
  expect(await page.locator('.reading-table').evaluate(n => getComputedStyle(n).outlineStyle)).toBe('solid');
});

test('PR3 : titres futurs, identifiants existants et collisions sans écrasement', async ({ page }) => {
  await page.route('**/assets/content.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nlessons[0].body = '<h2 id="section-meme-titre">Identifiant conservé</h2><h2>Même titre</h2><h3>Même titre</h3><h2 id="lecture-existante">Titre existant</h2><p>Contenu synthétique de test.</p>';` });
  });
  await scene(page);
  await expect(page.locator('.reading-toc a')).toHaveText(['Identifiant conservé', 'Même titre', 'Même titre', 'Titre existant']);
  expect(await page.locator('.reading-body h2,.reading-body h3').evaluateAll(nodes => nodes.map(n => n.id))).toEqual(['section-meme-titre', 'section-meme-titre-2', 'section-meme-titre-3', 'lecture-existante']);
  await page.locator('.reading-toc a').nth(2).press('Enter');
  await expect(page.locator('#section-meme-titre-3')).toBeFocused();
});

test('PR3 : unité longue, chapitres ouverts et cours accessibles sans accordéon', async ({ page }) => {
  await page.route('**/assets/content.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nfor (let i=0;i<30;i++) lessons.push({...lessons[0],id:'synthetic-'+i,unit:'uc2',order:i+1,chapter:'Chapitre synthétique '+(Math.floor(i/3)+1)});` });
  });
  await scene(page, `${prefix}uc.html?id=uc2`);
  await expect(page.locator('.course-chapter')).toHaveCount(10);
  await expect(page.locator('.lesson-row')).toHaveCount(30);
  await expect(page.locator('.unit-syllabus details')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Sommaire des chapitres' }).getByRole('link').last().press('Enter');
  await expect(page.locator('.course-chapter').last()).toBeFocused();
  await page.setViewportSize({ width: 320, height: 900 }); await noOverflow(page);
});

test('PR3 : complétion visiteur réversible, relecture durable et conservation du focus', async ({ page }) => {
  await scene(page);
  const checkbox = page.getByRole('checkbox', { name: 'Marquer ce cours comme terminé' });
  await checkbox.focus(); await page.keyboard.press('Space');
  await expect(page.locator('#done-state')).toHaveText('Terminé ✓');
  await expect(checkbox).toBeFocused();
  await page.reload(); await expect(checkbox).toBeChecked();
  await checkbox.uncheck(); await expect(page.locator('#done-state')).toHaveText('Pas encore terminé');
  await page.reload(); await expect(checkbox).not.toBeChecked();
});

test('PR3 : compte connecté, sauvegarde en erreur puis reprise sans succès fictif', async ({ page }, testInfo) => {
  const api = await personal(page);
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) {
      if (window.courseQuizStorageFull && this.transaction.db.name === 'mon-bprea-course-quiz-personal-v1') throw new DOMException('Stockage synthétique plein', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  await scene(page); await synced(page);
  await page.evaluate(() => window.courseQuizStorageFull = true);
  await page.locator('#mark-done').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#done-state')).toContainText('Erreur de sauvegarde');
  await expect(page.locator('#mark-done')).not.toBeChecked();
  expect(api.courses.size).toBe(0);
  await capture(page.locator('.course-finish'), 'course-save-error.png', testInfo);
  await page.evaluate(async () => {
    window.courseQuizStorageFull = false;
    await (await import('/mon-bprea/assets/course-quiz-service.js?v=e2e-lot5-1')).getCourseQuizService().then(s => s.retry());
  });
  await synced(page);
  await page.locator('#mark-done').check(); await synced(page);
  expect(api.courses.get(`${accounts.A.id}:matiere-organique`).done).toBe(true);
  await scene(page, `${prefix}uc.html?id=uc3`); await synced(page);
  await expect(page.locator('[data-unit-progress-label]')).toHaveText('1 / 4 cours terminés · 25 %');
  await expect(page.locator('[data-learning-source]')).toHaveText('Progression de ton compte');
});

test('PR3 : un retour de sauvegarde de A ne modifie pas B après changement d’époque', async ({ page }) => {
  const api = await personal(page); await scene(page); await synced(page);
  await page.evaluate(async () => {
    const service = await (await import('/mon-bprea/assets/course-quiz-service.js?v=e2e-lot5-1')).getCourseQuizService();
    const save = service.setCourseDone;
    service.setCourseDone = async (...args) => {
      const result = await save(...args);
      window.saveCompleted = true;
      await new Promise(resolve => { window.releaseCourseSave = resolve; });
      return result;
    };
  });
  await page.locator('#mark-done').check();
  await page.waitForFunction(() => window.saveCompleted);
  await expect(page.locator('#mark-done')).toBeDisabled();
  await page.evaluate(async email => {
    const auth = await (await import('/mon-bprea/assets/auth-service.js?v=e2e-lot5-1')).getAuthService();
    await auth.signOut(); await auth.signIn(email, 'synthetic-password');
  }, accounts.B.email);
  await synced(page);
  await expect(page.locator('#mark-done')).not.toBeChecked();
  await expect(page.locator('#mark-done')).toBeEnabled();
  await page.evaluate(() => window.releaseCourseSave());
  await expect(page.locator('#done-state')).toHaveText('Pas encore terminé');
  expect([...api.courses.values()].filter(row => row.user_id === accounts.B.id)).toHaveLength(0);
});

test('PR3 : cinq largeurs, texte 200 %, tableaux isolés et ordre mobile', async ({ page }) => {
  test.setTimeout(90000);
  for (const url of [`${prefix}uc.html?id=uc3`, `${prefix}uc.html?id=uc1`, ...lessons.map(l => `${prefix}cours.html?id=${l.id}`)]) {
    await scene(page, url);
    for (const large of [false, true]) {
      if (large) await page.addStyleTag({ content: 'html{font-size:200%!important}' });
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 }); await noOverflow(page);
        if (url.includes('cours.html')) {
          const table = page.locator('.reading-table');
          await expect(table).toBeAttached();
          if (width === 320) {
            await table.focus(); const before = await table.evaluate(n => n.scrollLeft);
            await page.keyboard.press('ArrowRight');
            await expect.poll(() => table.evaluate(n => n.scrollLeft)).toBeGreaterThan(before);
            const order = await page.locator('.reading-layout').evaluate(n => [...n.children].map(c => ({ top: c.getBoundingClientRect().top, class: c.className })));
            expect(order.map(n => n.top)).toEqual([...order.map(n => n.top)].sort((a, b) => a - b));
          }
        }
      }
    }
  }
});

test('PR3 : palettes, contrastes texte/contrôles, mouvement réduit, contraste forcé et sans filtre', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const report = [];
  for (const url of [course, `${prefix}uc.html?id=uc3`]) {
    await scene(page, url);
    for (const season of ['spring', 'summer', 'autumn', 'winter']) for (const theme of ['light', 'dark']) {
      await page.evaluate(({ season, theme }) => { document.documentElement.dataset.season = season; document.documentElement.dataset.theme = theme; }, { season, theme });
      const nodes = page.locator('.learning-cover :is(h1,p,.page-eyebrow,.learning-meta),.reading-body :is(h2,p,th,td,.note,.formula),.learning-card :is(h2,p,li,a),.unit-lessons :is(strong,.lesson-details>span),.unit-progress [data-unit-progress-label]');
      const rows = await textContrasts(nodes);
      for (const row of rows) expect(row.ratio, `${season}/${theme}: ${row.text.slice(0, 70)}`).toBeGreaterThanOrEqual(4.5);
      let controls = null;
      if (url === course) {
        controls = await page.locator('.course-finish').evaluate(root => {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          const light = value => {
            ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
            return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
          };
          const style = getComputedStyle(root), bg = light(style.backgroundColor);
          const ratio = color => { const value = light(color); return (Math.max(bg, value) + .05) / (Math.min(bg, value) + .05); };
          return { checkbox: ratio(getComputedStyle(root.querySelector('.check-visual')).borderTopColor), focus: ratio(style.getPropertyValue('--color-focus')) };
        });
        expect(controls.checkbox).toBeGreaterThanOrEqual(3); expect(controls.focus).toBeGreaterThanOrEqual(3);
      }
      report.push({ url, season, theme, minimum: Math.min(...rows.map(r => r.ratio)), controls });
    }
    await page.addStyleTag({ content: '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' });
    await noOverflow(page);
    await page.emulateMedia({ forcedColors: 'active' });
    const control = page.locator('.reading-toc a,.lesson-row').first(); await control.focus();
    expect(await control.evaluate(n => getComputedStyle(n).outlineStyle)).toBe('solid');
    await page.emulateMedia({ forcedColors: 'none' });
  }
  const path = testInfo.outputPath('learning-text-contrasts.json');
  await writeFile(path, JSON.stringify(report, null, 2));
  await testInfo.attach('learning-text-contrasts.json', { path, contentType: 'application/json' });
});

test('PR3 : captures comparatives et galerie de revue', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const names = [];
  async function shot(name, target = page) { await capture(target, name, testInfo); names.push(name); }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, url] of [['uc3', `${prefix}uc.html?id=uc3`], ['empty', `${prefix}uc.html?id=uc1`], ['course', course]]) {
      await scene(page, url); await shot(`after-${name}-${width}.png`);
      const before = `before-${name}-${width}.png`;
      await copyFile(fileURLToPath(new URL(`../fixtures/ui-2027-pr3-lot1/${before}`, import.meta.url)), testInfo.outputPath(before));
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 }); await scene(page);
  await capture(page, 'course-start.png', testInfo, { fullPage: false }); names.push('course-start.png');
  await shot('course-toc.png', page.locator('.reading-toc'));
  await shot('course-diagram.png', page.locator('.soil-flow'));
  await shot('course-table.png', page.locator('.reading-table'));
  await shot('course-essentials.png', page.locator('.reading-essentials'));
  await page.locator('.reading-body h2').nth(2).scrollIntoViewIfNeeded();
  await capture(page, 'course-middle.png', testInfo, { fullPage: false }); names.push('course-middle.png');
  await shot('course-end.png', page.locator('.course-finish'));
  await page.locator('#mark-done').check(); await expect(page.locator('#done-state')).toHaveText('Terminé ✓');
  await shot('course-completed.png', page.locator('.course-finish'));
  await page.locator('#theme-toggle').click(); await shot('course-dark.png');
  await scene(page, `${prefix}uc.html?id=uc3`); await page.locator('#theme-toggle').click(); await shot('uc3-dark.png');
  await page.locator('#theme-toggle').click(); await shot('uc3-progress.png');
  await page.setViewportSize({ width: 390, height: 1000 });
  await scene(page, `${prefix}cours.html?id=rapport-cn`);
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await shot('course-mobile-dark.png');
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.addStyleTag({ content: 'html{font-size:200%!important}*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' });
  await noOverflow(page);
  await page.locator('.reading-body h2').first().scrollIntoViewIfNeeded();
  await capture(page, 'reading-200-dark.png', testInfo, { fullPage: false }); names.push('reading-200-dark.png');
  await page.emulateMedia({ forcedColors: 'active' });
  await shot('completion-forced-colors.png', page.locator('.course-finish'));
  const figures = files => files.map(name => `<figure><figcaption>${name}</figcaption><a href="${name}"><img src="${name}" alt="${name}" loading="lazy"></a></figure>`).join('');
  const pairs = [1440, 390].flatMap(w => ['uc3', 'empty', 'course'].map(n => `<h2>${n} · ${w} px</h2><div class="pairs">${figures([`before-${n}-${w}.png`, `after-${n}-${w}.png`])}</div>`)).join('');
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lecture PR3 · revue</title><style>body{font:16px/1.6 system-ui;margin:24px;background:#faf7f0;color:#342f28}h1{font-size:28px}.pairs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0;padding:12px;background:white;border:1px solid #ded8cb;border-radius:16px}img{width:100%;height:auto}a{color:#954a32}figcaption{overflow-wrap:anywhere}@media(max-width:700px){.pairs{grid-template-columns:1fr}}</style><h1>UC et lecture · PR #61 → PR3 lot 1</h1><p>À gauche : base fe2f7e3. À droite : ce lot. Même viewport, automne/clair, 16 novembre 2026 à midi Paris, visiteur isolé, polices chargées, animations neutralisées. Les images sont des pièces de revue, sans approbation automatique de référence.</p>${pairs}<h2>Détails et états</h2><p>Les compléments incluent le sombre sur mobile, le texte à 200 % sans filtre et la complétion en contraste forcé.</p><div class="pairs">${figures(names.filter(n => !n.startsWith('after-')))}</div><p>L’erreur de sauvegarde et les contrastes sont joints au scénario dédié dans le même artefact Playwright. Pas de données personnelles ni de compte hébergé.</p></html>`;
  const path = testInfo.outputPath('revue-lecture.html'); await writeFile(path, html); await testInfo.attach('revue-lecture.html', { path, contentType: 'text/html' });
});
