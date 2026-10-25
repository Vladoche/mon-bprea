/** Retry policy shared by the independent personal synchronization domains. */
export const delayFor = count => Math.min(60000, 1000 * 2 ** Math.min(Math.max(0, count - 1), 6));

export function classifySyncError(error) {
  const code = error?.code;
  if (['invalid_session', 'session_changed', 'PGRST301', 'PGRST302', 'PGRST303'].includes(code) || error?.status === 401) return { kind: 'session', code: 'session', message: 'Reconnecte-toi au même compte pour synchroniser. Les réponses restent sur cet appareil.' };
  if (['42501', '23514', '23503', '23505', '23502', '22P02', 'protocol'].includes(code)) return { kind: 'permanent', code, message: 'Une opération ne peut pas être synchronisée. Ses données sont conservées ; vérifie les détails ou contacte la personne qui gère le site.' };
  return { kind: 'transient', code: code === '40001' ? '40001' : 'network', message: 'En attente de connexion. Les réponses sont enregistrées sur cet appareil.' };
}
