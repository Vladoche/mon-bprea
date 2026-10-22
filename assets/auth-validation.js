// Même limites que PostgreSQL pour le pseudo ; les mots de passe restent chez Auth.
export function validateEmail(email) {
  return typeof email === 'string' && email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? null : 'Saisis une adresse e-mail valide.';
}

export function validateCredentials(email, password) {
  return validateEmail(email) || (typeof password === 'string' && password.length > 0
    ? null : 'Saisis ton mot de passe.');
}

export function validatePassword(password, confirmation) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128)
    return 'Choisis un mot de passe de 12 à 128 caractères.';
  return password === confirmation ? null : 'Les deux mots de passe doivent être identiques.';
}

export function validatePseudo(pseudo) {
  if (pseudo === null || pseudo === '') return null;
  if (typeof pseudo !== 'string' || /[\u0000-\u001f\u007f-\u009f]/u.test(pseudo))
    return 'Le pseudo ne doit pas contenir de caractère de contrôle.';
  const value = pseudo.trim();
  return !value || ([...value].length >= 2 && [...value].length <= 40)
    ? null : 'Le pseudo doit contenir de 2 à 40 caractères, ou rester vide.';
}
