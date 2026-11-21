import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { accounts, createExportAPI, exportOrigin } from './export-api.js';

const profile = '/mon-bprea/profil.html';
const panelFor = page => page.getByRole('region', { name: 'Mon parcours BPREA' });
const opener = page => page.getByRole('button', { name: 'Configurer mon parcours BPREA' });
const title = page => page.getByRole('heading', { name: 'Mon parcours BPREA' });
const save = page => page.getByRole('button', { name: 'Enregistrer mon parcours', exact: true });
const ucare = [
  { id: 'atelier-a', label: 'Atelier fictif A', active: true },
  { id: 'atelier-b', label: 'Atelier fictif B', active: true },
];
const catalogue = { version: 1, ucareMinimum: null, ucare,
  sessions: [{ id: 'session-a', examId: 'uc3', label: 'Soutenance de test', date: '2027-06-10', active: true }] };

async function parcoursApi(context, fixtureCatalogue = catalogue) {
  const api = createExportAPI();
  await api.install(context);
  for (const account of Object.values(accounts)) api.rows[account.id].parcours_preferences = [];
  const state = { fail: false, writes: 0, rows: api.rows };
  if (fixtureCatalogue) await context.route('**/parcours-catalogue.json*', route => route.fulfill({ json: fixtureCatalogue }));
  await context.route(exportOrigin + '/rest/v1/rpc/personal_save_parcours', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    state.writes++;
    if (state.fail) return route.abort('failed');
    const input = request.postDataJSON();
    const owner = JSON.parse(Buffer.from(request.headers().authorization.split('.')[1], 'base64url')).sub;
    if (input.p_user_id !== owner) return route.fulfill({ status: 403, json: { code: '42501' }, headers });
    const records = state.rows[owner].parcours_preferences;
    const existing = records[0];
    if ((existing?.revision || 0) !== input.p_expected_revision) {
      return route.fulfill({ json: { status: 'conflict', row: existing || null }, headers });
    }
    const row = { user_id: owner, preferences: input.p_preferences, operation_id: input.p_operation_id,
      revision: input.p_expected_revision + 1, updated_at: new Date().toISOString() };
    records.splice(0, records.length, row);
    return route.fulfill({ json: { status: 'saved', row }, headers });
  });
  return state;
}

async function open(page) {
  await opener(page).click();
  await expect(panelFor(page)).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Je passe l’UC1' })).toBeEnabled();
}
async function signIn(page, account) {
  await page.goto('/mon-bprea/connexion.html');
  await page.getByLabel('Adresse e-mail').fill(accounts[account].email);
  await page.getByLabel('Mot de passe').fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/profil.html');
}

test('Paramètres, clavier, ouverture sans écriture, parcours complet et reprise du brouillon', async ({ page }) => {
  const api = await parcoursApi(page.context());
  await page.goto(profile);
  await expect(page.getByRole('heading', { name: 'Informations du compte' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Régler l’apparence' })).toBeEnabled();
  await expect(opener(page)).toHaveAccessibleDescription('À configurer');
  await expect(opener(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(panelFor(page)).toBeHidden();
  await opener(page).focus();
  await page.keyboard.press('Enter');
  await expect(title(page)).toBeFocused();
  await expect(opener(page)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  const close = page.getByRole('button', { name: 'Fermer le parcours' });
  await expect(close).toBeFocused();
  await expect(close).toHaveText('');
  await page.getByRole('radio', { name: 'Je passe l’UC1' }).check();
  await page.locator('.parcours-followed summary').click();
  await page.getByRole('group', { name: 'Autres UC suivies' }).getByRole('checkbox', { name: 'UC02' }).check();
  await page.getByRole('checkbox', { name: 'Atelier fictif A' }).check();
  await page.getByRole('checkbox', { name: 'Atelier fictif B' }).check();
  for (const name of ['UC01', 'UC03']) await page.getByRole('group', { name: 'Mes épreuves' }).getByRole('checkbox', { name }).check();
  await page.getByLabel('Date personnelle').fill('2027-06-02');
  await page.getByLabel('Épreuve', { exact: true }).selectOption('uc3');
  await page.getByLabel('Session officielle').selectOption('session-a');
  await expect(panelFor(page)).toContainText('session officielle le 10/06/2027');
  await expect(panelFor(page)).toContainText('date personnelle indicative le 02/06/2027');
  await expect(panelFor(page)).toContainText('Modifications non enregistrées');
  await page.getByRole('button', { name: 'Fermer le parcours' }).click();
  await expect(opener(page)).toBeFocused();
  await expect(opener(page)).toHaveAccessibleDescription('À configurer');
  expect(api.writes).toBe(0);
  await open(page);
  await expect(page.getByRole('checkbox', { name: 'Atelier fictif B' })).toBeChecked();
  await save(page).click();
  await expect(panelFor(page)).toContainText('Ton parcours a été enregistré et synchronisé.');
  await expect(opener(page)).toHaveAccessibleDescription('Parcours configuré');
  expect(api.writes).toBe(1);
  expect(api.rows[accounts.A.id].parcours_preferences[0].preferences.units).toEqual(['uc2']);
  await page.reload();
  await expect(panelFor(page)).toBeHidden();
  await open(page);
  await page.getByRole('radio', { name: 'Je suis dispensé de l’UC1' }).check();
  await expect(panelFor(page)).toContainText('Tu as indiqué une dispense d’UC1 et sélectionné son épreuve.');
  await expect(page.getByRole('checkbox', { name: 'UC01' })).toBeChecked();
  await page.reload();
  await open(page);
  await expect(page.getByRole('radio', { name: 'Je suis dispensé de l’UC1' })).toBeChecked();
  await expect(panelFor(page).getByRole('button', { name: 'Réinitialiser' })).toHaveCount(0);
  expect(api.writes).toBe(1);
  await page.getByRole('checkbox', { name: 'UC01' }).uncheck();
  await save(page).click();
  await expect(panelFor(page)).toContainText('Ton parcours a été enregistré et synchronisé.');
  expect(api.rows[accounts.A.id].parcours_preferences[0].preferences.uc1).toBe('exempt');
  expect(api.writes).toBe(2);
});

test('panne hors ligne, échec distant, reprise et isolation en changeant de compte', async ({ page, context }) => {
  const api = await parcoursApi(context, null);
  await page.goto(profile);
  await open(page);
  await expect(panelFor(page)).toContainText('La liste officielle des UCARE est en attente de validation.');
  await page.getByRole('radio', { name: 'Je suis dispensé de l’UC1' }).check();
  await context.setOffline(true);
  await save(page).click();
  await expect(panelFor(page).locator('[data-parcours-message]')).toHaveText('Enregistré sur cet appareil. Synchronisation en attente.');
  expect(api.writes).toBe(0);
  api.fail = true;
  await context.setOffline(false);
  await expect(panelFor(page)).toContainText('La synchronisation a échoué.');
  expect(api.writes).toBe(1);
  await expect(opener(page)).toHaveAccessibleDescription('À configurer');
  api.fail = false;
  await save(page).click();
  await expect(opener(page)).toHaveAccessibleDescription('Configuration partielle');
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(panelFor(page)).toBeHidden();
  await signIn(page, 'B');
  await open(page);
  await expect(page.getByRole('radio', { name: 'Non renseigné' })).toBeChecked();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await signIn(page, 'A');
  await open(page);
  await expect(page.getByRole('radio', { name: 'Je suis dispensé de l’UC1' })).toBeChecked();
  expect(api.writes).toBe(2);
});

test('version concurrente préservée et reprise explicite', async ({ page }) => {
  const api = await parcoursApi(page.context());
  await page.goto(profile);
  await open(page);
  await page.getByRole('radio', { name: 'Je passe l’UC1' }).check();
  api.rows[accounts.A.id].parcours_preferences.push({
    user_id: accounts.A.id, operation_id: accounts.B.id, revision: 1, updated_at: new Date().toISOString(),
    preferences: { version: 1, uc1: 'exempt', units: [], exams: [], ucare: [], assignments: {} },
  });
  await save(page).click();
  await expect(panelFor(page)).toContainText('Une autre version a été enregistrée.');
  await expect(page.getByRole('radio', { name: 'Je passe l’UC1' })).toBeChecked();
  expect(api.rows[accounts.A.id].parcours_preferences[0].preferences.uc1).toBe('exempt');
  await page.getByRole('button', { name: 'Enregistrer mes choix sur cette version' }).click();
  await expect(panelFor(page)).toContainText('Ton parcours a été enregistré et synchronisé.');
  expect(api.rows[accounts.A.id].parcours_preferences[0].revision).toBe(2);
});

test('composition responsive, étiquettes accessibles, thèmes et équivalent zoom 200 %', async ({ page, browser }) => {
  await parcoursApi(page.context());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(profile);
  await open(page);
  await page.getByRole('radio', { name: 'Je suis dispensé de l’UC1' }).check();
  await page.getByRole('checkbox', { name: 'Atelier fictif A' }).check();
  await page.getByRole('checkbox', { name: 'Atelier fictif B' }).check();
  await page.getByRole('checkbox', { name: 'UC03' }).check();
  await expect(page.getByLabel('Date personnelle')).toHaveAccessibleDescription(/Date indicative/);
  await page.getByLabel('Session officielle').selectOption('session-a');
  await page.evaluate(() => document.activeElement?.blur());
  await mkdir('.tmp/parcours-visual', { recursive: true });
  const reflow = async (target, wide) => {
    const metrics = await panelFor(target).evaluate(panel => {
      const [fields, summary] = [...panel.querySelector('.parcours-columns').children].map(e => e.getBoundingClientRect());
      return { horizontal: document.documentElement.scrollWidth > innerWidth,
        sideBySide: fields.right < summary.left && Math.abs(summary.top - fields.top) < 2,
        clipped: [...panel.querySelectorAll('select,input,button')].filter(e => e.getClientRects().length).some(e => e.getBoundingClientRect().right > innerWidth) };
    });
    expect(metrics).toEqual({ horizontal: false, sideBySide: wide, clipped: false });
  };
  for (const { width, brightness, customColor, capture } of [
    { width: 1440, brightness: 'dark', customColor: '#b598d5', capture: true },
    { width: 1024, brightness: 'dark' },
    { width: 768, brightness: 'light', capture: true },
    { width: 390, brightness: 'dark', capture: true },
    { width: 320, brightness: 'light', capture: true },
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(({ brightness, customColor }) => window.BpreaAppearance.applyPreferences({
      version: 1, season: 'autumn', brightness, ...(customColor ? { colorMode: 'custom', customColor } : {}),
    }), { brightness, customColor });
    await expect(page.locator('html')).toHaveAttribute('data-theme', brightness);
    if (customColor) await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'custom');
    await reflow(page, width >= 880);
    if (capture) await panelFor(page).screenshot({ path: `.tmp/parcours-visual/parcours-${width}-${brightness}.png` });
  }
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    await parcoursApi(mobile, null);
    const touch = await mobile.newPage();
    await touch.goto(profile);
    await opener(touch).tap();
    await expect(title(touch)).toBeFocused();
    await reflow(touch, false);
    await touch.getByRole('button', { name: 'Fermer le parcours' }).tap();
    await expect(opener(touch)).toBeFocused();
  } finally { await mobile.close(); }
  await page.setViewportSize({ width: 720, height: 450 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 720, height: 450, deviceScaleFactor: 2, mobile: false });
  await reflow(page, false);
});
