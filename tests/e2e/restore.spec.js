import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createExportAPI, accounts, exportOrigin } from './export-api.js';
import { archive, emptyServer, restoreRows, uuid } from '../fixtures/restore.js';
import { stopOrdinarySync } from '../helpers/export-browser.js';
import { personalRecords } from '../helpers/personal-browser.js';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const path = '/mon-bprea/profil.html';
function backup() {
  const rows = emptyServer(); rows.quiz_attempts = restoreRows().quiz_attempts.map((row, index) => ({ ...row, user_id: accounts.A.id, attempt_id: uuid(900 + index), lesson_id: 'restore-json' }));
  const file = archive(rows); file.sourceScope.userId = accounts.A.id; file.data.identity.id = accounts.A.id;
  return file;
}
async function select(page, value = backup()) {
  await page.locator('[data-restore-file]').setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) });
  await page.locator('[data-restore-analyze]').click();
}
async function setup(page, account = 'A') {
  await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
  const api = createExportAPI(); await api.install(page.context(), account); await page.goto(path);
  if (account) { await expect(page.locator('[data-export-prepare]')).toBeEnabled(); await stopOrdinarySync(page); }
  return api;
}
async function quizRPC(page, api, mode = 'success') {
  await page.route(`${exportOrigin}/rest/v1/rpc/personal_record_quiz`, async route => {
    api.writes.push('personal_record_quiz');
    if (mode === 'network') return route.abort('failed');
    const p = route.request().postDataJSON(), rows = api.rows[accounts.A.id].quiz_attempts;
    const old = rows.find(row => row.attempt_id === p.p_attempt_id);
    const row = backup().data.server.quiz_attempts.find(row => row.attempt_id === p.p_attempt_id);
    expect(row).toBeTruthy(); if (!old) rows.push(row);
    await route.fulfill({ json: { status: old ? 'replayed' : 'inserted', row }, headers: { 'access-control-allow-origin': '*' } });
  });
}

test('aperçu sans écriture, annulation clavier et contrôles accessibles mobile/sombre', async ({ page }) => {
  const api = await setup(page), before = await personalRecords(page, 'mon-bprea-course-quiz-personal-v1');
  await select(page); await expect(page.locator('[data-restore-status]')).toContainText('Aperçu prêt');
  await expect(page.locator('[data-restore-file-summary]')).toContainText('Compte, projet et environnement développement vérifiés');
  await expect(page.locator('[data-restore-apply]')).toBeDisabled(); expect(api.writes).toEqual([]);
  expect(await personalRecords(page, 'mon-bprea-course-quiz-personal-v1')).toEqual(before);
  await mkdir('.tmp/restore-visual', { recursive: true });
  for (const width of [1280, 390]) for (const brightness of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(brightness => window.BpreaAppearance.applyPreferences({ version: 1, season: 'auto', brightness }), brightness);
    await page.evaluate(() => document.activeElement?.blur());
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.data-restore').screenshot({ path: `.tmp/restore-visual/preview-${width}-${brightness}.png`, animations: 'disabled' });
  }
  await page.locator('[data-restore-cancel]').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-restore-file]')).toBeFocused(); await expect(page.locator('[data-restore-preview]')).toBeHidden();
  expect(await personalRecords(page, 'mon-bprea-course-quiz-personal-v1')).toEqual(before); expect(api.writes).toEqual([]);
});

test('confirmation, vrais records Chromium, reload et second import sans doublon (HTTP simulé)', async ({ page }) => {
  const api = await setup(page); await quizRPC(page, api);
  await select(page); await expect(page.locator('[data-restore-status]')).toContainText('Aperçu prêt');
  await page.locator('[data-restore-confirm]').focus(); await page.keyboard.press('Space');
  await page.locator('[data-restore-apply]').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-restore-status]')).toContainText('données compatibles confirmée');
  let record = (await personalRecords(page, 'mon-bprea-course-quiz-personal-v1'))[0];
  expect(Object.values(record.attempts).filter(row => row.lessonId === 'restore-json')).toHaveLength(2); expect(api.writes).toHaveLength(2);
  await page.reload(); await stopOrdinarySync(page);
  record = (await personalRecords(page, 'mon-bprea-course-quiz-personal-v1'))[0]; expect(Object.values(record.attempts).filter(row => row.lessonId === 'restore-json')).toHaveLength(2);
  await select(page); await expect(page.locator('[data-restore-status]')).toContainText('Aperçu prêt');
  await expect(page.locator('tbody tr').filter({ has: page.getByRole('rowheader', { name: 'QCM', exact: true }) })).toContainText('2');
  await expect(page.locator('[data-restore-apply]')).toBeDisabled(); expect(api.writes).toHaveLength(2);
});

test('fichier corrompu, version inconnue, tiers, autre projet et visiteur refusés', async ({ page }) => {
  const api = await setup(page);
  for (const file of ['{broken', { ...backup(), exportFormatVersion: 99 }]) { await select(page, file); await expect(page.locator('[data-restore-status]')).toContainText('refusée'); }
  const foreign = backup(); foreign.sourceScope.userId = accounts.B.id; foreign.data.identity.id = accounts.B.id; foreign.data.server.quiz_attempts.forEach(row => { row.user_id = accounts.B.id; });
  await select(page, foreign); await expect(page.locator('[data-restore-detail]')).toContainText('autre compte');
  const project = backup(); project.sourceScope.supabaseOrigin = 'https://other.invalid'; await select(page, project); await expect(page.locator('[data-restore-detail]')).toContainText('projet Supabase');
  expect(api.writes).toEqual([]);
  await page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click(); await expect(page.locator('[data-restore-file]')).toBeDisabled();
  await expect(page.locator('[data-restore-preview]')).toBeHidden();
});

test('lecture réseau indisponible puis perte pendant écriture : résultat en attente honnête', async ({ page }) => {
  const api = await setup(page); api.failLast = true;
  await select(page); await expect(page.locator('[data-restore-status]')).toContainText('Aperçu prêt');
  await expect(page.locator('[data-restore-warnings]')).toContainText('serveur est indisponible'); await expect(page.locator('[data-restore-apply]')).toBeDisabled(); expect(api.writes).toEqual([]);
  api.failLast = false; await quizRPC(page, api, 'network'); await select(page); await expect(page.locator('[data-restore-status]')).toContainText('Aperçu prêt');
  await page.locator('[data-restore-confirm]').check(); await page.locator('[data-restore-apply]').click();
  await expect(page.locator('[data-restore-status]')).toContainText('Restauration partielle');
  const record = (await personalRecords(page, 'mon-bprea-course-quiz-personal-v1'))[0];
  expect(record.operations.filter(op => [uuid(900), uuid(901)].includes(op.id)).every(op => op.state === 'pending')).toBe(true);
  await expect(page.locator('[data-restore-status]')).not.toContainText('compatibles confirmée');
});

test('bascule A→B→A pendant une réponse retardée invalide l’aperçu', async ({ page }) => {
  const api = await setup(page); let release, entered;
  const held = new Promise(resolve => { release = resolve; }), reached = new Promise(resolve => { entered = resolve; });
  api.hold = async table => { if (table === 'drill_series') { entered(); await held; } };
  await select(page); await reached;
  await page.evaluate(async () => {
    const app = new URL(document.querySelector('script[type=module][src]').src), url = new URL('./auth-service.js', app); url.search = app.search;
    const auth = await (await import(url.href)).getAuthService(); await auth.signOut(); await auth.signIn('course-b@example.invalid', 'synthetic-password'); await auth.signOut(); await auth.signIn('course-a@example.invalid', 'synthetic-password');
  });
  release(); api.hold = null;
  await expect(page.locator('[data-restore-status]')).toContainText('invalidé'); await expect(page.locator('[data-restore-preview]')).toBeHidden(); expect(api.writes).toEqual([]);
});
