import { it, expect } from 'vitest';
import { planRetention } from '../../scripts/retention-plan.mjs';
import { readFileSync } from 'node:fs';
const rule = { category: 'fictional', trigger: 'end', durationMs: 1000, purpose: 'fixture', justification: 'fixture only', validator: 'fixture role', archiveDecision: 'none', exceptionDecision: 'review', proof: 'counts' };
const policy = { validated: true, approval: 'fixture-only', rules: [rule] };
it('aucune règle ni validation implicite et règles incomplètes ne peuvent produire un candidat', () => {
  const project = JSON.parse(readFileSync(new URL('../../docs/rgpd/CONSERVATION-PROJET.json', import.meta.url)));
  expect(() => planRetention(project, [{ id: 'fixture', category: 'auth_profiles' }], 10000)).toThrow();
  for (const input of [null, {}, { rules: [rule] }, { ...policy, approval: '' }, { ...policy, rules: [{ ...rule, justification: '' }] }]) expect(() => planRetention(input, [], 10000)).toThrow();
  expect(planRetention({ ...policy, rules: [] }, [{ id: 'a', category: 'fictional' }], 10000)).toEqual([{ id: 'a', result: 'no_rule' }]);
});
it('horloge contrôlée, événement explicite, dernière activité, finalité active, exceptions et archives restent distincts', () => {
  const source = { id: 'a', category: 'fictional', createdAt: 0, events: { end: 10000 }, lastActivity: 10500 };
  expect(planRetention(policy, [source], 11000)[0].result).toBe('retain');
  expect(planRetention(policy, [source], 11500)[0].result).toBe('review_candidate');
  for (const change of [{ hold: true }, { activePurpose: true }, { archive: true }]) expect(planRetention(policy, [{ ...source, ...change }], 20000)[0].result).toBe('protected');
  expect(planRetention(policy, [{ ...source, events: {} }], 20000)[0].result).toBe('missing_event');
  expect(source.events.end).toBe(10000);
});
