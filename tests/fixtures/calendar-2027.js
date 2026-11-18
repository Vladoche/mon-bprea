const title = 'Observation des sols et comparaison des pratiques de préparation d’une parcelle avant implantation';
const location = 'Lieu synthétique — parcelle de démonstration, accès par le chemin pédagogique et rendez-vous à l’abri du matériel';

export const course = {
  id: 'cours-sol',
  title,
  type: 'cours',
  start: '2027-06-14',
  unit: 'uc3',
  location,
  description: 'Première ligne du jeu de tests.\n\nDeuxième ligne avec le texte littéral <strong>sans balisage</strong>.',
};

const stage = {
  id: 'stage-periode',
  title: 'Observation en entreprise',
  type: 'stage',
  start: '2027-06-11',
  end: '2027-06-17',
  location: 'Exploitation du jeu de tests',
};

const vacation = {
  id: 'vacances-transition',
  title: 'Pause de formation',
  type: 'vacances',
  start: '2027-06-28',
  end: '2027-07-05',
};

export const exam = {
  id: 'examen-uc3',
  title: 'Évaluation de la conduite d’un atelier',
  type: 'examen',
  start: '2027-06-14',
  end: '2027-06-15',
  unit: 'uc3',
  location: 'Salle du jeu de tests',
  description: 'Prévoir le dossier du jeu de tests.',
};

export const example = {
  id: 'exemple-evaluation',
  title: 'Simulation d’entretien',
  type: 'examen',
  start: '2027-06-14',
  unit: 'uc-inconnue',
  example: true,
};

const newYear = {
  id: 'stage-transition-annee',
  title: 'Période à cheval sur deux années',
  type: 'stage',
  start: '2027-12-30',
  end: '2028-01-03',
};

const invalid = { ...course, id: 'date-invalide', title: 'Date impossible de test', start: '2027-06-31' };

export const sparse = { version: 1, events: [course, stage, vacation] };
export const busy = { version: 1, events: [exam, stage, example, course, vacation, newYear, invalid] };
export const empty = { version: 1, events: [] };
