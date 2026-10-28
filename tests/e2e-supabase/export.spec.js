import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { createDrillStudent, configureDrillPage, signInDrill } from '../helpers/drill-local.js';
import { LOCAL_SITE } from '../helpers/auth-local.js';
import { personalScope } from '../../assets/drill-personal-store.js';
import { emptyPersonalDocument, mutateCourse } from '../../assets/course-quiz-model.js';
import { TABLES } from '../../assets/export-sources.js';
import { stopOrdinarySync } from '../helpers/export-browser.js';
import { seedPersonalTables as seed, readPersonalTables as sqlSnapshot } from '../helpers/personal-data-local.js';

async function copy(page) {
  await page.locator('[data-export-prepare]').click(); await expect(page.locator('[data-export-status]')).toContainText('Copie prête');
  const pending = page.waitForEvent('download'); await page.locator('[data-export-download]').click();
  return JSON.parse(await readFile(await (await pending).path(), 'utf8'));
}
test('Export réel : dix tables, pagination, caches en attente, RLS A/B et session perdue', async ({ page }) => {
  test.setTimeout(150000); const students = []; let stage = 'comptes éphémères', failure;
  try {
    const a = await createDrillStudent(); students.push(a); const b = await createDrillStudent(); students.push(b);
    stage = 'fixtures SQL sous JWT étudiants'; await seed(a, 205); await seed(b, 2);
    const beforeA = await sqlSnapshot(a), beforeB = await sqlSnapshot(b);
    // Assertions use student JWTs only. The anonymous client has no admin key.
    const anon = createClient(a.environment.url, a.environment.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const [name, spec] of Object.entries(TABLES)) {
      const foreign = await a.client.from(name).select(spec.fields.join(',')).eq(spec.owner, b.userId);
      expect(foreign.error === null && foreign.data.length === 0).toBe(true);
      const anonymous = await anon.from(name).select(spec.fields.join(',')); expect(Boolean(anonymous.error)).toBe(true);
    }
    stage = 'cache A en attente et copie téléchargée';
    const scope = personalScope({ environment: 'development', url: a.environment.url, userId: a.userId });
    const document = emptyPersonalDocument(scope); mutateCourse(document, 'export-local-uniquement', false, randomUUID);
    await configureDrillPage(page, a.environment);
    await page.addInitScript(({ scope, document }) => {
      if (localStorage.getItem('export-local-fixture')) return;
      localStorage.setItem('export-local-fixture', 'yes');
      const request = indexedDB.open('mon-bprea-course-quiz-personal-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('accounts');
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('accounts', 'readwrite'); tx.objectStore('accounts').put(document, scope);
        tx.oncomplete = () => db.close();
      };
    }, { scope, document });
    // Only writes are interrupted to keep an actual pending intention. Auth,
    // SQL reads, RLS and downloaded data still use the real ephemeral backend.
    await page.route(`${a.environment.url}/rest/v1/rpc/**`, route => route.abort('failed'));
    await signInDrill(page, a); await page.goto(`${LOCAL_SITE}profil.html`);
    await stopOrdinarySync(page);
    const fileA = await copy(page);
    expect(fileA.data.identity.id === a.userId).toBe(true);
    expect(Object.keys(fileA.data.server).length === 10).toBe(true); expect(fileA.data.server.quiz_attempts.length === 205).toBe(true);
    expect(fileA.data.server.course_states[0].done === false).toBe(true);
    expect(fileA.data.personalLocal.courses.operations.some(op => op.payload.p_lesson_id === 'export-local-uniquement')).toBe(true);
    expect(JSON.stringify(fileA).includes(b.userId)).toBe(false);
    for (const secret of ['access_token', 'refresh_token', 'token_hash', 'service_role']) expect(JSON.stringify(fileA).includes(secret)).toBe(false);
    expect(JSON.stringify(await sqlSnapshot(a)) === JSON.stringify(beforeA)).toBe(true);
    stage = 'compte B dans le même navigateur';
    await page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click();
    await expect(page.locator('[data-export-download]')).toBeDisabled();
    await signInDrill(page, b); await page.goto(`${LOCAL_SITE}profil.html`); const fileB = await copy(page);
    expect(fileB.sourceScope.userId === b.userId).toBe(true); expect(fileB.data.server.quiz_attempts.length === 2).toBe(true);
    expect(JSON.stringify(fileB).includes(a.userId)).toBe(false); expect(JSON.stringify(fileB).includes('export-local-uniquement')).toBe(false);
    expect(JSON.stringify(await sqlSnapshot(b)) === JSON.stringify(beforeB)).toBe(true);
    stage = 'session révoquée pendant préparation';
    let released, entered; const gate = new Promise(resolve => { released = resolve; }), reached = new Promise(resolve => { entered = resolve; });
    await page.route(`${b.environment.url}/rest/v1/drill_series*`, async route => {
      entered(); await gate;
      try { await route.continue(); } catch { /* Expected: export AbortController cancelled the held request. */ }
    });
    await page.locator('[data-export-prepare]').click(); await reached;
    await page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click(); released();
    await expect(page.locator('[data-export-download]')).toBeDisabled(); await expect(page.locator('[data-export-prepare]')).toBeDisabled();
  } catch { failure = new Error(`Export Supabase local non validé : ${stage}. Données, sessions et fichier non journalisés.`); }
  finally {
    await page.close();
    for (const student of students.toReversed()) try { await student.cleanup(); } catch { failure = new Error('Nettoyage des seuls comptes fictifs export incomplet.'); }
    if (failure) throw failure;
  }
});
