import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createDrillStudent, configureDrillPage, signInDrill } from '../helpers/drill-local.js';
import { itkPath, itkParameters, settingsAction, settingsSynced, generateItk, expectItk, chooseAppearance, closeAppearance, settingsRecords } from '../helpers/settings-browser.js';

// Only the guarded local fixture provisions accounts. Pedagogical assertions
// below read PostgreSQL through the fictitious student's actual JWT.
async function rows(student, table) {
  await student.refresh();
  const result = await student.client.from(table).select('*').eq('user_id', student.userId);
  expect(result.error).toBeNull(); return result.data;
}
async function signIn(page, student) { await signInDrill(page, student); await page.goto(itkPath); await settingsSynced(page); }
async function clean(students, contexts, failure) {
  for (const context of contexts) await context.close();
  for (const student of students.toReversed()) try { await student.cleanup(); }
  catch { failure = new Error('Nettoyage incomplet des seuls comptes fictifs de paramètres locaux.'); }
  if (failure) throw failure;
}

test('Paramètres réels A : deux appareils, huit valeurs ITK, apparence auto et séparation A/B', async ({ page, browser }) => {
  test.setTimeout(120000);
  const students = [], contexts = []; let stage = 'comptes locaux', failure;
  try {
    const a = await createDrillStudent(), b = await createDrillStudent(); students.push(a, b);
    await configureDrillPage(page, a.environment); await signIn(page, a);
    stage = 'paramètres ITK et apparence enregistrés'; await generateItk(page); await settingsSynced(page);
    await chooseAppearance(page, 'winter', 'dark'); await settingsSynced(page); await closeAppearance(page);
    expect((await rows(a, 'itk_settings'))[0].parameters).toEqual(itkParameters);
    expect((await rows(a, 'appearance_preferences'))[0]).toMatchObject({ season: 'winter', brightness: 'dark' });
    const context = await browser.newContext({ timezoneId: 'Europe/Paris', locale: 'fr-FR' }); contexts.push(context);
    const second = await context.newPage(); await configureDrillPage(second, a.environment); await signIn(second, a);
    stage = 'deuxième appareil'; await expectItk(second, itkParameters);
    await expect(second.locator('html')).toHaveAttribute('data-season', 'winter'); await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(second.locator('#csv-export')).toHaveCount(0);
    await chooseAppearance(second, 'auto', 'auto'); await settingsSynced(second); await closeAppearance(second);
    await settingsAction(page, 'retry'); await settingsSynced(page);
    stage = 'mêmes préférences auto, calculs locaux jour et nuit';
    await page.clock.setFixedTime(new Date('2026-10-25T12:00:00.000Z'));
    await second.clock.setFixedTime(new Date('2026-10-25T23:00:00.000Z'));
    await page.evaluate(() => window.BpreaAppearance.refresh()); await second.evaluate(() => window.BpreaAppearance.refresh());
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light'); await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect((await rows(a, 'appearance_preferences'))[0]).toMatchObject({ season: 'auto', brightness: 'auto' });
    stage = 'autre compte sur le même profil';
    await page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click();
    await signIn(page, b); expect((await settingsAction(page, 'state')).view.itk).toBeNull();
    expect((await settingsAction(page, 'state')).view.appearance).toBeNull();
    for (const table of ['itk_settings', 'appearance_preferences']) {
      expect(await rows(b, table)).toEqual([]);
      const foreign = await b.client.from(table).select('*').eq('user_id', a.userId); expect(foreign.error).toBeNull(); expect(foreign.data).toEqual([]);
    }
    await page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click(); await signIn(page, a); await expectItk(page, itkParameters);
    expect(await settingsRecords(page)).toHaveLength(2);
  } catch { failure = new Error(`Paramètres Supabase locaux non validés : ${stage}. Aucun jeton ni mot de passe publié.`); }
  finally { await clean(students, contexts, failure); }
});

test('Paramètres réels B : hors ligne, rechargement et acquittement perdu après commit PostgreSQL', async ({ page }) => {
  test.setTimeout(120000); const students = []; let stage = 'compte local', failure;
  try {
    const a = await createDrillStudent(); students.push(a); await configureDrillPage(page, a.environment); await signIn(page, a);
    await generateItk(page); await settingsSynced(page);
    const outage = route => route.abort('failed'), pattern = `${a.environment.url}/rest/v1/**`;
    await page.route(pattern, outage); stage = 'modifications successives hors ligne';
    await generateItk(page, { ...itkParameters, area: '200' });
    await chooseAppearance(page, 'summer', 'dark'); await chooseAppearance(page, 'winter', 'dark'); await chooseAppearance(page, 'auto', 'auto'); await closeAppearance(page);
    await expect(page.locator('#itk-sync-status')).toContainText(/ligne|attente/i);
    const before = (await settingsRecords(page))[0]; await page.reload(); await expectItk(page, { ...itkParameters, area: '200' });
    const after = (await settingsRecords(page))[0]; expect(after.operations.map(item => item.id)).toEqual(before.operations.map(item => item.id));
    stage = 'reprise avec perte après commit'; await page.unroute(pattern, outage);
    const sent = [], rpc = '**/rest/v1/rpc/personal_save_itk';
    const lose = async route => { sent.push(JSON.parse(route.request().postData())); const response = await route.fetch(); if (sent.length === 1) await route.abort('failed'); else await route.fulfill({ response }); };
    await page.route(rpc, lose); await settingsAction(page, 'retry');
    await expect.poll(() => sent.length).toBeGreaterThanOrEqual(2); await settingsSynced(page); expect(sent[0]).toEqual(sent[1]);
    expect(await rows(a, 'itk_settings')).toHaveLength(1); expect((await rows(a, 'itk_settings'))[0].parameters.area).toBe('200');
    expect((await rows(a, 'appearance_preferences'))[0]).toMatchObject({ season: 'auto', brightness: 'auto' });
    await page.unroute(rpc, lose); await settingsAction(page, 'retry'); await settingsSynced(page);
    expect((await rows(a, 'itk_settings'))[0].revision).toBe(2);
  } catch { failure = new Error(`Reprise des paramètres locaux non validée : ${stage}.`); }
  finally { await clean(students, [], failure); }
});

test('Paramètres réels C : conflits CAS conservés par domaine et résolution volontaire', async ({ page }) => {
  test.setTimeout(120000); const students = []; let release = () => {}, stage = 'compte local', failure;
  try {
    const a = await createDrillStudent(); students.push(a); await configureDrillPage(page, a.environment); await signIn(page, a);
    await generateItk(page); await settingsSynced(page); await chooseAppearance(page, 'winter', 'dark'); await settingsSynced(page); await closeAppearance(page);
    const bodies = {};
    async function compete(domain, localAction, replacement) {
      let sent; const gate = new Promise(resolve => { release = resolve; });
      const rpc = `**/rest/v1/rpc/personal_save_${domain}`;
      const hold = async route => { sent = JSON.parse(route.request().postData()); await gate; await route.continue(); };
      await page.route(rpc, hold); await localAction(); await expect.poll(() => !!sent).toBe(true); bodies[domain] = sent;
      await a.refresh(); const winner = await a.client.rpc(`personal_save_${domain}`, { ...sent, ...replacement, p_operation_id: randomUUID() });
      expect(winner.error).toBeNull(); expect(winner.data.status).toBe('updated'); release();
      await expect.poll(async () => (await settingsAction(page, 'state')).sync.conflicts.filter(item => !item.resolved && item.domain === domain).length).toBe(1);
      await page.unroute(rpc, hold);
    }
    stage = 'tomate locale et carotte concurrente';
    const carrot = { ...itkParameters, crop: 'carotte', variety: 'Nantaise', area: '300' };
    await compete('itk', () => generateItk(page, { ...itkParameters, area: '250' }), { p_parameters: carrot });
    expect((await rows(a, 'itk_settings'))[0].parameters).toEqual(carrot);
    stage = 'apparence concurrente sans bloquer l’autre domaine';
    await compete('appearance', () => chooseAppearance(page, 'summer', 'dark'), { p_preferences: { version: 1, season: 'spring', brightness: 'dark' } });
    expect((await rows(a, 'appearance_preferences'))[0].season).toBe('spring');
    await expect(page.locator('#appearance-conflicts')).toContainText('Conflit');
    await page.locator('#appearance-conflicts summary').last().click();
    await page.locator('#appearance-conflicts').getByRole('button', { name: 'Garder la version du compte', exact: true }).click(); await closeAppearance(page);
    expect((await rows(a, 'appearance_preferences'))[0].season).toBe('spring');
    stage = 'décision ITK explicite, nouvelle identité et nouvelle base';
    await page.locator('#itk-conflicts summary').last().click();
    await page.locator('#itk-conflicts').getByRole('button', { name: 'Utiliser mon choix enregistré sur cet appareil', exact: true }).click(); await settingsSynced(page);
    const final = (await rows(a, 'itk_settings'))[0]; expect(final.parameters.area).toBe('250'); expect(final.revision).toBe(3);
    expect(final.operation_id).not.toBe(bodies.itk.p_operation_id); expect(final.base_revision).toBe(2);
    expect((await settingsRecords(page))[0].conflicts.filter(item => item.resolved)).toHaveLength(2);
  } catch { failure = new Error(`Concurrence des paramètres locaux non validée : ${stage}.`); }
  finally { release(); await clean(students, [], failure); }
});

test('Paramètres réels D : imports distincts, source conservée et confirmation répétée sans nouvelle intention', async ({ page }) => {
  test.setTimeout(90000); const students = []; let stage = 'sources visiteur', failure;
  const raw = JSON.stringify({ ...itkParameters, area: '321' });
  try {
    const a = await createDrillStudent(); students.push(a); await configureDrillPage(page, a.environment);
    await page.addInitScript(value => { if (!sessionStorage.getItem('settings-import-source')) { localStorage.setItem('bprea-demo-itk-v1', value); localStorage.setItem('bprea-demo-theme-v1', 'dark'); sessionStorage.setItem('settings-import-source', 'yes'); } }, raw);
    await signIn(page, a); expect(await rows(a, 'itk_settings')).toHaveLength(0); expect(await rows(a, 'appearance_preferences')).toHaveLength(0);
    stage = 'examen et confirmation ITK'; await page.getByRole('button', { name: 'Examiner les paramètres locaux', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Importer les paramètres ITK' })).toContainText('321');
    await page.getByRole('button', { name: 'Confirmer l’import ITK', exact: true }).click(); await settingsSynced(page);
    expect((await rows(a, 'itk_settings'))[0].parameters.area).toBe('321'); expect(await rows(a, 'appearance_preferences')).toHaveLength(0);
    const first = await settingsAction(page, 'previewImport', 'itk'); await settingsAction(page, 'confirmImport', first); await settingsSynced(page);
    expect((await rows(a, 'itk_settings'))[0].revision).toBe(1);
    stage = 'choix legacy volontaire et sans date fictive'; const appearance = await settingsAction(page, 'previewImport', 'appearance');
    await settingsAction(page, 'confirmImport', appearance); await settingsSynced(page);
    expect((await rows(a, 'appearance_preferences'))[0]).toMatchObject({ season: 'auto', brightness: 'dark', client_updated_at: null });
    expect(await page.evaluate(() => localStorage.getItem('bprea-demo-itk-v1'))).toBe(raw);
    expect(await page.evaluate(() => localStorage.getItem('bprea-demo-theme-v1'))).toBe('dark');
    stage = 'source modifiée après aperçu'; const preview = await settingsAction(page, 'previewImport', 'itk');
    await page.evaluate(value => localStorage.setItem('bprea-demo-itk-v1', value), JSON.stringify({ ...itkParameters, area: '999' }));
    const refused = await settingsAction(page, 'confirmImport', preview); expect(refused.error).toBeTruthy();
    expect((await rows(a, 'itk_settings'))[0].revision).toBe(1);
  } catch { failure = new Error(`Import des paramètres locaux non validé : ${stage}.`); }
  finally { await clean(students, [], failure); }
});
