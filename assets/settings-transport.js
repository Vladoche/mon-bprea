import { classifySyncError } from './sync-runtime.js';
import { TABLES, appearanceColorColumns } from './export-sources.js';
const names = { itk: 'personal_save_itk', appearance: 'personal_save_appearance' };
const tables = { itk: 'itk_settings', appearance: 'appearance_preferences' };
const columns = { itk: TABLES.itk_settings.fields.join(','), appearance: TABLES.appearance_preferences.fields.join(',') };
const appearanceColumns = [columns.appearance, ...appearanceColorColumns].join(',');
const changed = () => Object.assign(new Error('Le compte a changé.'), { code: 'session_changed' });
export function classifySettingsError(error) {
  if (error?.status === 403 || error?.code === '42501') return { kind: 'session', code: 'session', message: 'L’accès personnel doit être vérifié à nouveau. Reconnecte-toi au même compte ; les paramètres sont conservés.' };
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code)) return { kind: 'permanent', code: error.code, message: 'Le stockage personnel ITK et apparence n’est pas disponible. Les choix restent sur cet appareil.' };
  const issue = classifySyncError(error);
  return { ...issue, message: issue.kind === 'session'
    ? 'Reconnecte-toi au même compte pour synchroniser. Les paramètres et choix restent sur cet appareil.'
    : issue.kind === 'permanent' ? 'Une opération ne peut pas être synchronisée. Les paramètres et son diagnostic sont conservés.'
      : 'Connexion indisponible. Les paramètres et choix sont enregistrés sur cet appareil en attente de synchronisation.' };
}
export function createSettingsTransport(client, auth, userId) {
  let appearanceColorsAvailable = null;
  async function checked(build, { signal, active = () => true } = {}) {
    if (!active()) throw changed();
    const verified = await auth.verifiedSession(userId);
    if (!active() || verified.userId !== userId || !verified.accessToken) throw changed();
    const timeout = AbortSignal.timeout(15000);
    const result = await build().retry(false).setHeader('Authorization', `Bearer ${verified.accessToken}`).abortSignal(signal ? AbortSignal.any([signal, timeout]) : timeout);
    if (!active() || auth.getState().user?.id !== userId || auth.getState().status !== 'authenticated') throw changed();
    if (result.error) throw result.error;
    return result.data;
  }
  return {
    send(operation, options) {
      if (!Object.hasOwn(names, operation.domain) || !operation.rpcPayload) throw Object.assign(new Error('Opération inconnue.'), { code: 'protocol' });
      if (appearanceColorsAvailable === false && operation.domain === 'appearance' && operation.rpcPayload.p_preferences?.colorMode)
        throw Object.assign(new Error('Le serveur ne prend pas encore en charge les couleurs personnalisées.'), { code: 'appearance_schema_pending' });
      return checked(() => client.rpc(names[operation.domain], operation.rpcPayload), options);
    },
    async readSettings(options) {
      const remote = {};
      for (const domain of ['itk', 'appearance']) {
        const read = fields => checked(() => client.from(tables[domain]).select(fields).eq('user_id', userId).limit(2), options);
        let rows;
        try {
          rows = await read(domain === 'appearance' ? appearanceColumns : columns[domain]);
          if (domain === 'appearance') appearanceColorsAvailable = true;
        }
        catch (error) {
          if (domain !== 'appearance' || error?.code !== '42703') throw error;
          rows = await read(columns.appearance);
          appearanceColorsAvailable = false;
        }
        if (!Array.isArray(rows) || rows.length > 1) throw Object.assign(new Error('Réponse personnelle incohérente.'), { code: 'protocol' });
        remote[domain] = rows[0] || null;
      }
      return remote;
    },
  };
}
