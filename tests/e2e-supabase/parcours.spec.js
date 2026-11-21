import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createDrillStudent, configureDrillPage, signInDrill } from '../helpers/drill-local.js';
import { LOCAL_SITE } from '../helpers/auth-local.js';
import { emptyParcours } from '../../assets/parcours-model.js';

async function open(page) {
  await page.goto(LOCAL_SITE + 'profil.html');
  await page.getByRole('button', { name: 'Configurer mon parcours BPREA' }).click();
  await expect(page.getByRole('radio', { name: 'Je passe l’UC1' })).toBeEnabled();
}

test('Parcours réel, deux appareils, vrai JWT A/B et écritures concurrentes', async ({ page, browser }) => {
  test.setTimeout(120000);
  const students = [];
  const secondDevice = await browser.newContext();
  try {
    const a = await createDrillStudent();
    students.push(a);
    const b = await createDrillStudent();
    students.push(b);
    await configureDrillPage(page, a.environment);
    await signInDrill(page, a);
    await open(page);
    await page.getByRole('radio', { name: 'Je passe l’UC1' }).check();
    await page.getByRole('checkbox', { name: 'UC03' }).check();
    await page.getByLabel('Date personnelle').fill('2027-07-01');
    await page.getByRole('button', { name: 'Enregistrer mon parcours', exact: true }).click();
    await expect(page.locator('[data-parcours-message]')).toContainText('enregistré et synchronisé');

    const second = await secondDevice.newPage();
    await configureDrillPage(second, a.environment);
    await signInDrill(second, a);
    await open(second);
    await expect(second.getByRole('radio', { name: 'Je passe l’UC1' })).toBeChecked();
    await expect(second.getByLabel('Date personnelle')).toHaveValue('2027-07-01');

    await a.refresh();
    await b.refresh();
    const payload = { p_user_id: a.userId, p_preferences: { ...emptyParcours(), uc1: 'exempt' },
      p_operation_id: randomUUID(), p_expected_revision: 1 };
    const foreign = await b.client.from('parcours_preferences').select('user_id').eq('user_id', a.userId);
    expect(foreign.error).toBeNull();
    expect(foreign.data).toEqual([]);
    const forbidden = await b.client.rpc('personal_save_parcours', payload);
    expect(forbidden.error?.code).toBe('42501');
    const direct = await a.client.from('parcours_preferences').update({ revision: 7 }).eq('user_id', a.userId);
    expect(direct.error?.code).toBe('42501');
    const race = await Promise.all([a.client.rpc('personal_save_parcours', payload), a.client.rpc('personal_save_parcours', {
      ...payload, p_operation_id: randomUUID(), p_preferences: { ...payload.p_preferences, uc1: 'attending' },
    })]);
    expect(race.map(result => result.error)).toEqual([null, null]);
    expect(race.map(result => result.data.status).sort()).toEqual(['conflict', 'saved']);
    const winning = race.find(result => result.data.status === 'saved').data.row;
    const persisted = await a.client.from('parcours_preferences').select('revision,preferences').single();
    expect(persisted.error).toBeNull();
    expect(persisted.data).toEqual({ revision: 2, preferences: winning.preferences });
  } finally {
    await secondDevice.close();
    for (const student of students.toReversed()) await student.cleanup();
  }
});
