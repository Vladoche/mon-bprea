import { expect, it } from 'vitest';
import { itkDisplayParameters } from '../../assets/itk-personal-ui.js';
import { validateItk } from '../../assets/settings-model.js';

it('garde les choix visiteurs reconnus sans transformer un repli d’affichage en preuve pour l’import', () => {
  const source = { crop: 'carotte', variety: 'Marmande', area: '250', unknown: { keep: true } };
  const original = JSON.stringify(source);
  const display = itkDisplayParameters(source);
  expect(display).toMatchObject({ crop: 'carotte', variety: 'Nantaise', area: '250', year: '2028' });
  expect(validateItk(display)).toBe(true);
  expect(validateItk(source)).toBe(false);
  expect(JSON.stringify(source)).toBe(original);
});

it('un stockage visiteur illisible conserve un formulaire cohérent sans reprise d’un cache personnel', () => {
  for (const source of [null, [], 'invalide', { crop: 'inconnue', area: 'Infinity', month: '99' }]) {
    expect(itkDisplayParameters(source)).toMatchObject({ crop: 'tomate', variety: 'Marmande', area: '100', month: '5' });
  }
});
