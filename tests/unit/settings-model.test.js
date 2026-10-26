import { describe, expect, it } from 'vitest';
import { emptySettingsDocument, validateSettingsDocument, validateItk, validateAppearance, queueSettings, prepareSettingsOperation, acknowledgeSettings, reconcileSettings, resolveSettingsConflict } from '../../assets/settings-model.js';
const user = '11111111-1111-4111-8111-111111111111';
const scope = JSON.stringify(['development', 'https://fixture.invalid', user]);
const at = '2026-10-20T10:00:00.000Z';
const itk = { crop: 'tomate', variety: 'Roma', cover: 'serre', area: '100', month: '5', year: '2028', soil: 'limoneux', water: 'standard' };
const appearance = { version: 1, season: 'auto', brightness: 'auto' };
let sequence = 0;
const uuid = () => `99999999-9999-4999-8999-${String(++sequence).padStart(12, '0')}`;
const row = (op, owner = user) => ({ user_id: owner, ...(op.domain === 'itk' ? { parameters: op.payload.p_parameters } : { ...op.payload.p_preferences, client_updated_at: op.payload.p_preferences.updatedAt || null }), operation_id: op.id, base_revision: op.expectedRevision, revision: op.expectedRevision + 1, schema_version: 1, created_at: at, updated_at: at });
describe('contrat singletons ITK/apparence', () => {
  it('valide exactement huit chaînes, catalogue, variété et bornes métier', () => {
    expect(validateItk(itk)).toBe(true);
    for (const value of [{ ...itk, area: 100 }, { ...itk, area: '1.5' }, { ...itk, area: '100000.0000000000000001' }, { ...itk, area: '1.0000000000000000001' }, { ...itk, crop: 'other' }, { ...itk, variety: 'Touchon' }, { ...itk, month: '01' }, { ...itk, year: '2034' }, { ...itk, unknown: 'keep' }]) expect(validateItk(value)).toBe(false);
    for (const area of ['1', '+100', '1e5', '100.000', '.1e1']) expect(validateItk({ ...itk, area })).toBe(true);
  });
  it('conserve auto, refuse rendu et dates impossibles sans transformer source', () => {
    expect(validateAppearance(appearance)).toBe(true);
    expect(validateAppearance({ ...appearance, updatedAt: null })).toBe(true);
    expect(validateAppearance({ ...appearance, updatedAt: '2026-02-30T10:00:00Z' })).toBe(false);
    expect(validateAppearance({ ...appearance, dataTheme: 'dark' })).toBe(false);
    expect(validateAppearance({ ...appearance, season: 'night' })).toBe(false);
  });
  it('compacte seulement les intentions jamais envoyées et garde un diagnostic borné', () => {
    const doc = emptySettingsDocument(scope);
    for (let index = 0; index < 40; index++) queueSettings(doc, 'appearance', { ...appearance, season: index % 2 ? 'winter' : 'summer' }, uuid);
    expect(doc.operations).toHaveLength(1); expect(doc.operations[0].expectedRevision).toBe(0);
    expect(doc.archives).toHaveLength(20); expect(doc.archivedCount).toBe(19);
    expect(validateSettingsDocument(doc, scope)).toBe(doc);
  });
  it('chaîne après livraison incertaine, retry strictement identique puis successeur', () => {
    const doc = emptySettingsDocument(scope); queueSettings(doc, 'appearance', { ...appearance, season: 'summer' }, uuid);
    const first = prepareSettingsOperation(doc, 0); queueSettings(doc, 'appearance', appearance, uuid);
    expect(doc.operations[1].dependsOn).toBe(first.id); expect(doc.operations[1].expectedRevision).toBe(1);
    const retry = prepareSettingsOperation(doc, 0); expect(retry.id).toBe(first.id); expect(retry.rpcPayload).toEqual(first.rpcPayload);
    acknowledgeSettings(doc, first.id, { status: 'inserted', row: row(first) }, user);
    const next = prepareSettingsOperation(doc, 0); expect(next.id).toBe(doc.operations[1].id); expect(next.payload.p_preferences.season).toBe('auto');
    acknowledgeSettings(doc, next.id, { status: 'updated', row: row(next) }, user); expect(doc.values.appearance.season).toBe('auto');
  });
  it('conserve ancienne intention supersédée, serveur et dernier choix conflictuel', () => {
    const doc = emptySettingsDocument(scope); queueSettings(doc, 'appearance', { ...appearance, season: 'summer' }, uuid);
    const first = prepareSettingsOperation(doc, 0); queueSettings(doc, 'appearance', { ...appearance, season: 'winter' }, uuid); queueSettings(doc, 'appearance', appearance, uuid);
    const winner = { ...row(first), operation_id: uuid(), base_revision: 1, revision: 2, season: 'spring' };
    reconcileSettings(doc, { appearance: winner, itk: null }, user, at);
    expect(doc.values.appearance.season).toBe('spring'); expect(doc.conflicts[0].local.season).toBe('auto'); expect(doc.operations[1].state).toBe('blocked');
    const result = resolveSettingsConflict(doc, first.id, 'local', uuid);
    expect(result.operationId).not.toBe(first.id); expect(doc.operations.at(-1).expectedRevision).toBe(2); expect(doc.operations.at(-1).payload.p_preferences.season).toBe('auto');
  });
  it('un conflit ITK ne bloque pas une préférence et garder serveur ne renvoie rien', () => {
    const doc = emptySettingsDocument(scope); queueSettings(doc, 'itk', itk, uuid); const op = prepareSettingsOperation(doc, 0);
    acknowledgeSettings(doc, op.id, { status: 'conflict', row: { ...row(op), operation_id: uuid(), parameters: { ...itk, crop: 'carotte', variety: 'Touchon' } } }, user);
    queueSettings(doc, 'appearance', appearance, uuid); expect(prepareSettingsOperation(doc, 0).domain).toBe('appearance');
    const length = doc.operations.length; resolveSettingsConflict(doc, op.id, 'remote', uuid); expect(doc.operations.filter(item => item.state === 'pending')).toHaveLength(1); expect(doc.operations.length).toBeLessThanOrEqual(length);
  });
  it('ne confirme jamais mauvais propriétaire, payload, révision ou statut', () => {
    for (const transform of [r => ({ ...r, user_id: uuid() }), r => ({ ...r, parameters: { ...itk, area: '3' } }), r => ({ ...r, revision: 4 }), r => ({ ...r, created_at: '2026-02-30T10:00:00Z' }), r => ({ ...r, updated_at: '2026-10-20' })]) {
      const doc = emptySettingsDocument(scope); queueSettings(doc, 'itk', itk, uuid); const op = prepareSettingsOperation(doc, 0);
      expect(() => acknowledgeSettings(doc, op.id, { status: 'inserted', row: transform(row(op)) }, user)).toThrow(); expect(doc.operations[0].state).toBe('pending');
    }
  });
  it('refuse cache futur, dépendance cassée et payload modifié avant tout envoi', () => {
    const doc = emptySettingsDocument(scope); queueSettings(doc, 'itk', itk, uuid);
    for (const corrupt of [saved => { saved.version = 9; }, saved => { saved.operations[0].dependsOn = saved.operations[0].id; }, saved => { saved.operations[0].rpcPayload.p_parameters.area = '2'; }]) {
      const saved = structuredClone(doc); corrupt(saved); expect(() => validateSettingsDocument(saved, scope)).toThrow();
    }
  });
  it('borne les reçus confirmés après une longue série sans toucher la dernière valeur', () => {
    const doc = emptySettingsDocument(scope);
    for (let index = 0; index < 40; index++) { queueSettings(doc, 'itk', { ...itk, area: String(index + 1) }, uuid); const op = prepareSettingsOperation(doc, 0); acknowledgeSettings(doc, op.id, { status: index ? 'updated' : 'inserted', row: row(op) }, user); }
    expect(doc.operations.length).toBeLessThanOrEqual(8); expect(doc.archives.length).toBeLessThanOrEqual(20); expect(doc.values.itk.area).toBe('40'); validateSettingsDocument(doc, scope);
  });
});
