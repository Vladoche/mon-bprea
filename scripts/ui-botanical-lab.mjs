import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect } from '@playwright/test';
import { answerBotanical, botanicalStorageKey, currentBotanicalPhoto, finishBotanical, nextBotanical } from '../tests/helpers/botanical-browser.js';

const phases = ['before', 'after'];
const photoRoute = '**/assets/botanical-photos/**';
const botanicalUrl = (origin, phase) => `${origin}/${phase}/reconnaissance-plantes.html`;
const startButton = page => page.locator('[data-start]');
const time = page => page.locator('#bot-time');
const choices = page => page.locator('[data-choice]');
const history = page => page.locator('#bot-history');
const readVisitor = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), botanicalStorageKey);

export async function seedBotanicalLab(context, { season = 'autumn', brightness = 'light', deterministic = false } = {}) {
  await context.addInitScript(({ season, brightness, deterministic }) => {
    localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season, brightness }));
    Math.random = () => 0;
    if (deterministic) crypto.randomUUID = () => {
      const counter = Number(sessionStorage.getItem('botanical-lab-uuid')) + 1;
      sessionStorage.setItem('botanical-lab-uuid', counter);
      return `aaaaaaaa-aaaa-4aaa-aaaa-${String(counter).padStart(12, '0')}`;
    };
  }, { season, brightness, deterministic });
}

async function openBotanical(page, origin, phase) {
  await page.goto(botanicalUrl(origin, phase));
  await startButton(page).waitFor();
}

async function chronology(page, duration) {
  await page.getByRole('radio', { name: /^Chrono/ }).check();
  const selector = page.getByRole('combobox', { name: 'Durée par question' });
  await expect(selector.locator('option')).toHaveText(['15 secondes', '30 secondes', '45 secondes', '60 secondes']);
  await selector.selectOption(String(duration));
}

async function questionContract(page) {
  const { photo, image } = await currentBotanicalPhoto(page);
  await expect(choices(page).first()).toBeEnabled();
  const optionIds = await choices(page).evaluateAll(buttons => buttons.map(button => button.dataset.choice));
  assert.equal(new Set(optionIds).size, 4);
  assert.ok(optionIds.includes(photo.speciesId));
  return { photo: photo.id, alt: await image.getAttribute('alt'), choices: optionIds };
}

async function resultContract(page) {
  return page.locator('#bot-result-data dt').evaluateAll(terms => Object.fromEntries(terms
    .filter(term => !['Photographies passées', 'Durée chronométrée'].includes(term.textContent))
    .map(term => {
      const value = term.nextElementSibling.textContent;
      const label = term.textContent === 'Expirations du chrono' ? 'Temps écoulés' : term.textContent;
      return [label, ['Aucune donnée', 'Non calculable'].includes(value) ? null : value];
    })));
}

async function visibleTab(page, visible) {
  await page.evaluate(visible => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: !visible });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible);
}

async function replayVisitor(page, origin, phase) {
  const referenceTime = new Date('2026-11-19T12:00:00Z');
  await page.clock.install({ time: new Date(referenceTime.getTime() - 1000) });
  await page.clock.pauseAt(referenceTime);
  await openBotanical(page, origin, phase);
  const categories = await page.locator('[data-category]').evaluateAll(buttons => buttons.map(button => ({
    id: button.dataset.category, disabled: button.disabled, counts: button.textContent.match(/\d+ (?:espèce|question)s?/g),
  })));
  assert.equal(categories.filter(item => !item.disabled).length, 3);
  assert.ok(categories.find(item => item.id === 'legumineuses')?.disabled);
  await history(page).locator('summary').click();
  await expect(history(page)).toContainText('Aucune question réalisée');
  const revision = page.getByRole('checkbox', { name: /Revoir mes erreurs/ });
  await revision.check();
  await expect(startButton(page)).toBeDisabled();
  await revision.uncheck();
  await startButton(page).click();
  const discovery = [];
  for (let index = 0; index < 4; index++) {
    await expect(page.locator('#bot-question-heading')).toHaveText(`Question ${index + 1} sur 4`);
    discovery.push(await questionContract(page));
    await page.clock.fastForward(2000 + index * 100);
    await answerBotanical(page, index !== 0);
    await nextBotanical(page);
  }
  const completeResult = await resultContract(page);
  assert.equal(completeResult['Taux de reconnaissance'], '75 %');
  await page.locator('[data-new]').click();
  await revision.check();
  await startButton(page).click();
  await expect(page.locator('#bot-question-heading')).toHaveText('Question 1 sur 1');
  const retry = await questionContract(page);
  assert.equal(retry.photo, discovery[0].photo);
  await answerBotanical(page);
  await nextBotanical(page);
  const revisionResult = await resultContract(page);
  await page.locator('[data-new]').click();
  await expect(page.locator('#bot-revision-count')).toHaveText('1');
  await revision.uncheck();

  await page.locator('[data-category="fleurs"]').click();
  await page.getByRole('radio', { name: /^Chrono/ }).check();
  await expect(page.locator('#bot-duration')).toHaveValue('30');
  await chronology(page, 15);
  const waitingImage = Promise.withResolvers();
  await page.route(photoRoute, async route => { await waitingImage.promise; await route.continue(); }, { times: 1 });
  await startButton(page).click();
  await expect(page.getByText('Chargement de la photographie…', { exact: true })).toBeVisible();
  await page.clock.fastForward(7000);
  await expect(time(page)).toHaveText('15 s');
  await expect(choices(page).first()).toBeDisabled();
  waitingImage.resolve();
  const chrono = [await questionContract(page)];
  await page.clock.runFor(4000);
  await expect(time(page)).toHaveText('11 s');
  await page.locator('[data-pause]').click();
  await page.clock.runFor(5003);
  await visibleTab(page, false);
  await visibleTab(page, true);
  await expect(time(page)).toHaveText('11 s');
  await expect(choices(page).first()).toBeDisabled();
  await page.locator('[data-pause]').click();
  await visibleTab(page, false);
  await page.clock.runFor(6000);
  await expect(time(page)).toHaveText('11 s');
  await visibleTab(page, true);
  await choices(page).first().click();
  await page.clock.runFor(11001);
  // The clock is past expiry, with the next 200 ms UI tick still pending.
  await expect(page.locator('[data-validate]')).toBeEnabled();
  await page.locator('[data-validate]').click();
  await expect(page.locator('#bot-feedback')).toContainText('Temps écoulé');
  await finishBotanical(page);
  const timeoutResult = await resultContract(page);
  if (phase === 'after') await expect(page.locator('.bot-result-time dd')).toHaveText('15 s');
  await page.locator('[data-new]').click();

  await chronology(page, 30);
  await startButton(page).click();
  chrono.push(await questionContract(page));
  await expect(time(page)).toHaveText('30 s');
  await page.clock.fastForward(29999);
  await answerBotanical(page);
  await finishBotanical(page);
  const partialResult = await resultContract(page);
  await page.locator('[data-new]').click();

  await page.locator('[data-category="legumes"]').click();
  await chronology(page, 45);
  let failures = 0;
  await page.route(photoRoute, route => { failures++; return route.abort(); }, { times: 2 });
  await startButton(page).click();
  await expect(page.locator('[data-retry-image]')).toBeVisible();
  await page.locator('[data-retry-image]').click();
  await expect(page.locator('[data-retry-image]')).toBeVisible();
  await page.clock.fastForward(60000);
  assert.equal(failures, 2);
  await expect(time(page)).toHaveText('45 s');
  await expect(choices(page).first()).toBeDisabled();
  await page.locator('[data-skip-image]').click();
  await finishBotanical(page);
  const skippedResult = await resultContract(page);
  assert.equal(skippedResult['Taux de reconnaissance'], null);

  await openBotanical(page, origin, phase);
  await chronology(page, 60);
  const lateImage = Promise.withResolvers();
  await page.route(photoRoute, async route => { await lateImage.promise; await route.continue(); }, { times: 1 });
  await startButton(page).click();
  await expect(time(page)).toHaveText('60 s');
  await finishBotanical(page);
  const downloaded = page.waitForResponse(response => response.url().includes('/botanical-photos/'));
  lateImage.resolve();
  await (await downloaded).finished();
  await expect(page.locator('.bot-photo-frame img')).toHaveCount(0);
  const emptyResult = await resultContract(page);
  const stored = await readVisitor(page);
  assert.deepEqual(stored.answers.map(item => item.status), ['incorrect', 'correct', 'correct', 'correct', 'correct', 'timeout', 'correct', 'skipped_image']);
  assert.deepEqual(stored.answers.slice(5).map(item => item.elapsedMs), [15000, 29999, 0]);
  const aggregates = await page.evaluate(async answers => {
    const { calculateStats } = await import(new URL('assets/botanical-engine.js', document.baseURI));
    return { history: calculateStats(answers), replay: calculateStats([...answers, ...answers]) };
  }, stored.answers);
  assert.deepEqual(aggregates.history, aggregates.replay);
  return { categories, discovery, retry, chrono, completeResult, revisionResult, timeoutResult, partialResult, skippedResult, emptyResult, stored, aggregates };
}

export async function writeBotanicalParity(browser, { origin, baselineRef, directory }) {
  const observations = {};
  for (const phase of phases) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Paris', reducedMotion: 'reduce' });
    try {
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await seedBotanicalLab(context, { deterministic: true });
      observations[phase] = await replayVisitor(await context.newPage(), origin, phase);
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(observations.after, observations.before);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'parite.json'), JSON.stringify({ baselineRef, ...observations, identical: true }, null, 2));
}

export function installBotanicalObserver() {
  window.__botanicalMarks = {};
  document.addEventListener('click', event => {
    const selector = ['start', 'choice', 'validate', 'next', 'stop'].find(key => event.target.closest(`[data-${key}]`));
    if (selector) window.__botanicalMarks[selector] = performance.now();
  }, true);
}

export async function measureBotanical(page) {
  const paint = key => page.evaluate(key => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
    resolve(performance.now() - window.__botanicalMarks[key]);
  }))), key);
  await chronology(page, 60);
  await startButton(page).click();
  await page.locator('#bot-question-heading').waitFor();
  const startMs = await paint('start');
  const photo = await currentBotanicalPhoto(page);
  const imageMs = await paint('start');
  const clock = await time(page).textContent();
  await choices(page).first().click();
  const choiceMs = await paint('choice');
  await page.locator('[data-validate]').click();
  await page.locator('#bot-correction-title').waitFor();
  const correctionMs = await paint('validate');
  await nextBotanical(page);
  await expect(page.locator('#bot-question-heading')).toHaveText('Question 2 sur 4');
  const nextMs = await paint('next');
  await currentBotanicalPhoto(page);
  const nextImageMs = await paint('next');
  await finishBotanical(page);
  const resultsMs = await paint('stop');
  const transfer = await page.evaluate(() => {
    const images = performance.getEntriesByType('resource').filter(entry => entry.name.includes('/botanical-photos/'));
    return { photoRequests: images.length, photoBytes: images.reduce((sum, entry) => sum + entry.decodedBodySize, 0) };
  });
  assert.equal(transfer.photoRequests, 2, 'Une requête de photographie par question affichée');
  return { startMs, imageMs, clock, choiceMs, correctionMs, nextMs, nextImageMs, resultsMs, photo: photo.photo.id, ...transfer };
}
