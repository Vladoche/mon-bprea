import { describe, expect, it } from 'vitest';
import { validateCredentials, validatePassword, validatePseudo } from '../../assets/auth-validation.js';

describe('validation des champs du compte', () => {
  it('accepte une adresse valide et conserve les mots de passe existants à la connexion', () => {
    expect(validateCredentials('eleve-a@example.invalid', 'ancien-mdp')).toBeNull();
    expect(validateCredentials(' eleve-a@example.invalid ', 'ancien-mdp')).toBeNull();
  });

  it.each([
    ['', 'mot-de-passe'], ['adresse-invalide', 'mot-de-passe'],
    ['a@', 'mot-de-passe'], ['a@example.invalid', ''],
  ])('refuse des identifiants incomplets sans contacter le serveur (%s)', (email, password) => {
    expect(validateCredentials(email, password)).toEqual(expect.any(String));
  });

  it('exige un nouveau mot de passe suffisant et une confirmation identique', () => {
    const password = 'Mot-de-passe-fixture-2026!';
    expect(validatePassword(password, password)).toBeNull();
    expect(validatePassword('court', 'court')).toEqual(expect.any(String));
    expect(validatePassword(password, `${password}x`)).toEqual(expect.any(String));
    expect(validatePassword('', '')).toEqual(expect.any(String));
  });

  it('autorise le pseudo facultatif et les caractères Unicode usuels', () => {
    expect(validatePseudo('')).toBeNull();
    expect(validatePseudo(null)).toBeNull();
    expect(validatePseudo('Élève du potager')).toBeNull();
    expect(validatePseudo('é'.repeat(40))).toBeNull();
    expect(validatePseudo('🌱'.repeat(40))).toBeNull();
    expect(validatePseudo('é'.repeat(41))).toEqual(expect.any(String));
  });

  it('refuse les pseudos trop longs et les caractères de contrôle', () => {
    expect(validatePseudo('a'.repeat(1000))).toEqual(expect.any(String));
    expect(validatePseudo('Camille\nAutre')).toEqual(expect.any(String));
    expect(validatePseudo('Camille\u0000')).toEqual(expect.any(String));
  });
});
