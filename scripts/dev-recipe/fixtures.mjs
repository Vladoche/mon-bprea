// Plan synthétique uniquement : aucune connexion, aucun envoi et aucun UUID Auth inventé.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { syntheticEmail, DEV_API, DEV_PROJECT, MAX_MUTATIONS } from './contract.mjs';

export function fixturePlan(run) {
  const bank = JSON.parse(readFileSync(new URL('../../assets/drill-bank.json', import.meta.url), 'utf8'));
  return { version: 1, run, actors: ['A', 'B'],
    dates: { start: '2026-10-29T12:00:00.000Z', answer: '2026-10-29T12:01:00.000Z', end: '2026-10-29T12:10:00.000Z' },
    drill: { unit: 'uc3', week: '2026-W44', previousWeek: '2026-W43', questions: bank.questions.filter(q => q.unit === 'uc3').slice(0, 10) },
    courses: ['matiere-organique', 'rapport-cn'], quiz: { scores: [0, 3, 0, 0], total: 3 },
    botanical: { categoryId: 'petits-fruits', mode: 'chrono', durationSeconds: 30, revision: false,
      statuses: ['correct', 'incorrect', 'timeout', 'skipped_image'], sessionPrefix: run },
    itk: { crop: 'tomate', variety: 'Marmande', cover: 'serre', area: '100', month: '4', year: '2027', soil: 'limoneux', water: 'standard' },
    appearance: { seasons: ['auto', 'spring', 'summer', 'autumn', 'winter'], brightness: ['auto', 'light', 'dark'] },
    operationIds: Array.from({ length: MAX_MUTATIONS }, () => randomUUID()),
    limits: { maxAccounts: 2, maxRows: 150, maxMutations: MAX_MUTATIONS, maxGeneratedLinks: 3 },
    note: 'Affecter chaque UUID une seule fois à une intention volontaire ; réutiliser exactement UUID/base/payload pour un retry. Construire les JSON v1 via les vrais modèles et la portée Auth fraîche au point C.' };
}
export function targetPreflightSql(run) {
  // Adresses intégralement construites par un contrat fermé ; aucun paramètre SQL libre.
  const a = syntheticEmail(run, 'A'), b = syntheticEmail(run, 'B');
  return `-- Cible exclusive ${DEV_PROJECT} / ${DEV_API}. Métadonnées des deux seules identités synthétiques.
begin transaction read only;
select count(*) filter (where email='${a}') as a_count,
       count(*) filter (where email='${b}') as b_count
from auth.users where email in ('${a}','${b}');
rollback;
`;
}
