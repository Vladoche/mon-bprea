import { test, expect } from '@playwright/test';
import { copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { capture } from '../helpers/ui-review.js';
import { lessons } from '../../assets/content.js';

const prefix = '/mon-bprea/';
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T11:00:00Z') });
  await page.addInitScript(() => localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness: 'light' })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function ready(page) {
  await page.goto(prefix);
  await expect(page.locator('[data-unit-percent="uc3"]')).toHaveText('0 % des cours terminés');
  await page.locator('.home-garden img').evaluate(img => img.decode());
  await page.evaluate(() => document.fonts.ready);
}

test('PR2b : panorama, cours exacts et vraie progression agrégée', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready(page);
  const hero = page.locator('.home-hero');
  const image = hero.locator('img');
  await expect(image).toHaveAttribute('fetchpriority', 'high');
  await expect(image).not.toHaveAttribute('loading', 'lazy');
  expect(await image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  const box = await hero.boundingBox();
  expect(box.width / box.height).toBeGreaterThan(2.8);
  const cards = page.locator('.home-modules .home-course-card');
  for (const [index, lesson] of lessons.slice(0, 3).entries()) {
    await expect(cards.nth(index)).toHaveAttribute('href', `cours.html?id=${lesson.id}`);
    await expect(cards.nth(index)).toContainText(lesson.title);
  }
  await expect(page.locator('.home-unit-progress')).toHaveJSProperty('value', 0);
  await page.evaluate(() => localStorage.setItem('bprea-demo-progress-v1', JSON.stringify({ 'matiere-organique': { done: true } })));
  await page.reload();
  await expect(page.locator('[data-unit-percent="uc3"]')).toHaveText('25 % des cours terminés');
  await expect(page.locator('.home-unit-progress')).toHaveJSProperty('value', 25);
  await expect(page.locator('[data-revision-start]')).toHaveAttribute('href', 's-exercer.html');
  await expect(page.locator('.home-support li')).toHaveCount(4);
  await expect(page.locator('.home-all-courses a')).toHaveCount(1);
  await expect(page.locator('.home-actions a').last()).toHaveAttribute('href', 'mes-cours.html');
});

test('PR2b : état inconnu sans jauge inventée et chargement conservé', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Synthetic unavailable storage', 'SecurityError'); } }));
  await page.goto(prefix);
  await expect(page.locator('[data-unit-percent="uc3"]')).toHaveText('Progression indisponible');
  await expect(page.locator('.home-unit-progress')).toBeHidden();
  await expect(page.locator('.home-unit-progress')).not.toHaveAttribute('value');
  await expect(page.locator('.home-course-card')).toHaveCount(3);
  await expect(page.locator('[data-revision-start]')).toBeVisible();
});

test('PR2b : galerie comparative, cinq largeurs, zones et hubs', async ({ page }, testInfo) => {
  const names = [];
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const name = `pr2b-home-${width}-light.png`;
    await capture(page, name, testInfo); names.push(name);
    if ([1440, 390].includes(width)) {
      const hero = await page.locator('.home-hero').boundingBox();
      const header = await page.locator('header').boundingBox();
      const headerName = `pr2b-header-hero-${width}.png`;
      await capture(page, headerName, testInfo, { clip: { x: 0, y: 0, width, height: Math.ceil(hero.y + hero.height) } });
      expect(header.y).toBeLessThan(hero.y); names.push(headerName);
      for (const [selector, zone] of [['.home-hero', 'hero'], ['.home-modules', 'carnets'], ['.home-support', 'benefices'], ['.home-all-courses', 'appel'], ['footer', 'footer']]) {
        const name = `pr2b-${zone}-${width}.png`;
        await capture(page.locator(selector), name, testInfo); names.push(name);
      }
      await page.locator('#theme-toggle').click();
      const name = `pr2b-home-${width}-dark.png`;
      await capture(page, name, testInfo); names.push(name);
    }
  }
  for (const file of ['mes-cours', 's-exercer', 'outils']) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}${file}.html`);
    await expect(page.locator('.hub-unit-card,.hub-link-card').first()).toBeVisible();
    const name = `pr2b-${file}-${width}.png`;
    await capture(page, name, testInfo); names.push(name);
  }
  for (const file of ['maquette.png', 'pr2.png']) {
    const path = testInfo.outputPath(file);
    await copyFile(fileURLToPath(new URL(`../fixtures/ui-2027-pr2b/${file}`, import.meta.url)), path);
    await testInfo.attach(file, { path, contentType: 'image/png' });
  }
  const figure = (file, title) => `<figure><figcaption>${title}</figcaption><a href="${file}"><img src="${file}" alt="${title}" loading="lazy"></a><a download href="${file}">Télécharger</a></figure>`;
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revue PR2b</title><style>body{font:16px/1.6 system-ui;background:#f5f1eb;color:#292c26;margin:24px}h1{margin-bottom:8px}main,.zones{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}figure{margin:0;background:white;padding:12px;border-radius:16px}img{display:block;width:100%;height:auto}figcaption{font-weight:bold}a{color:#684028}@media(max-width:800px){main,.zones{grid-template-columns:1fr}}</style><h1>Maquette → PR2 → PR2b</h1><p>Largeurs normalisées dans les colonnes ; proportions d’origine conservées. Référence 1087 px, captures 1440 px. Pas de comparaison pixel à pixel entre une image de design et le DOM. Captures proposées à validation humaine, aucune référence approuvée automatiquement.</p><main>${figure('maquette.png', 'Maquette du propriétaire')}${figure('pr2.png', 'PR2 fournie par le propriétaire')}${figure('pr2b-home-1440-light.png', 'PR2b · 1440 px')}</main><h2>Écarts restant à apprécier</h2><p>La serre est une création originale, pas une copie de la photo de référence. Les trois longs titres, descriptions et états réels demandent des cartes plus hautes. Progression agrégée de l’UC 03, aucun pourcentage individuel inventé. Header PR1 et liens légaux réels conservés. Icônes sobres et contraste renforcé ; feuillage périphérique décoratif de la maquette non reproduit. Sur mobile, paysage intégré en bas du panneau et cartes verticales.</p><h2>Zones, responsive, sombre et hubs</h2><div class="zones">${names.filter(name => name !== 'pr2b-home-1440-light.png').map(name => figure(name, name.replace('pr2b-', '').replace('.png', ''))).join('')}</div></html>`;
  const path = testInfo.outputPath('revue-visuelle.html');
  await writeFile(path, html);
  await testInfo.attach('revue-visuelle.html', { path, contentType: 'text/html' });
});

// Sample the rendered photographic surface with text temporarily transparent.
// This includes the real gradient/photo instead of assuming an ancestor's solid color.
async function photographicContrasts(page) {
  const samples = await page.locator('.home-hero-copy').evaluate(root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const values = [];
    while (walker.nextNode()) {
      const node = walker.currentNode; if (!node.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      values.push({ text: node.textContent.trim(), color: getComputedStyle(node.parentElement).color, rects: [...range.getClientRects()].map(r => ({ x:r.x, y:r.y, width:r.width, height:r.height })) });
    }
    return values;
  });
  const style = await page.addStyleTag({ content: '.home-hero-copy,.home-hero-copy *{color:transparent!important;text-shadow:none!important}' });
  let screenshot;
  try { screenshot = await page.screenshot({ animations: 'disabled' }); }
  finally { await style.evaluate(node => node.remove()); }
  return page.evaluate(async ({ samples, png }) => {
    const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image,0,0);
    const luminance = rgb => rgb.map(v => { const c=v/255; return c<=.04045?c/12.92:((c+.055)/1.055)**2.4; }).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    return samples.map(sample => {
      const foreground = luminance(sample.color.match(/[\d.]+/g).slice(0,3).map(Number)); let min=Infinity;
      for (const r of sample.rects) for (const dx of [.05,.25,.5,.75,.95]) for (const dy of [.2,.5,.8]) {
        const x=Math.floor(r.x+r.width*dx), y=Math.floor(r.y+r.height*dy);
        if(x<0||y<0||x>=image.width||y>=image.height) continue;
        const bg=luminance([...ctx.getImageData(x,y,1,1).data].slice(0,3));
        min=Math.min(min,(Math.max(foreground,bg)+.05)/(Math.min(foreground,bg)+.05));
      }
      return { text:sample.text, ratio:min };
    });
  }, { samples, png:screenshot.toString('base64') });
}

test('PR2b : contrastes sur photographie, filtre absent, clavier et mouvement réduit', async ({ page }, testInfo) => {
  const report=[];
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1500 }); await ready(page);
    // Simulates an engine without backdrop-filter while retaining the same surfaces.
    await page.addStyleTag({ content:'*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' });
    for (const theme of ['light','dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('#theme-toggle').click();
      const ratios=await photographicContrasts(page);
      for (const value of ratios) expect(value.ratio,`${width} ${theme}: ${value.text}`).toBeGreaterThanOrEqual(4.5);
      report.push({width,theme,ratios});
    }
    await page.locator('[data-revision-start]').focus();
    await expect(page.locator('[data-revision-start]')).toBeFocused();
    await page.keyboard.press('Tab'); await expect(page.locator('.home-actions a').last()).toBeFocused();
    expect(await page.locator('.home-course-card').first().evaluate(node=>getComputedStyle(node).transitionDuration)).toBe('0s');
  }
  await testInfo.attach('photographic-contrast.json',{body:JSON.stringify(report,null,2),contentType:'application/json'});
});
