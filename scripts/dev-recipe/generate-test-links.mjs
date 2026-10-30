// Bibliothèque dédiée hébergée ; jamais appelée par les runners locaux/CI.
import { createClient } from '@supabase/supabase-js';
import { DEV_API, DEV_CALLBACK, DEV_PROJECT, UUID, fail, validateEnvironment, validatePreflight,
  syntheticEmail, operationSlot, boundedAdminFetch, buildDevLink } from './contract.mjs';

export async function generateTestLink({ env, run, sha, proof, type, actor, previous, confirmA, confirmB,
  reserve, record, present, now = Date.now, makeAdmin }) {
  validateEnvironment(env);
  const slot = operationSlot(type, actor), email = syntheticEmail(run, actor);
  validatePreflight(proof, run, sha, now(), type, actor);
  if (previous?.[slot]) fail('spent');
  const existing = previous?.['invite-A'];
  if (type === 'recovery' && (existing?.status !== 'presented' || !UUID.test(existing.id || ''))) fail('approval');
  if (await confirmA({ project: DEV_PROJECT, run, sha }) !== true
      || await confirmB({ project: DEV_PROJECT, run, sha, type, actor }) !== true) fail('approval');
  validatePreflight(proof, run, sha, now(), type, actor);
  if (!/^sb_secret_[A-Za-z0-9_-]{16,256}$/.test(env.MON_BPREA_DEV_ADMIN_KEY || '')) fail('key');
  // Une réservation durable et exclusive est indispensable AVANT le premier appel.
  await reserve(slot);
  const expectedId = type === 'recovery' ? existing.id : undefined;
  const adminFactory = makeAdmin || (() => createClient(DEV_API, env.MON_BPREA_DEV_ADMIN_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: boundedAdminFetch({ type, email, userId: expectedId }) },
  }).auth.admin);
  try {
    const admin = adminFactory();
    if (expectedId) {
      const result = await admin.getUserById(expectedId);
      if (result.error || result.data?.user?.id !== expectedId || result.data.user.email !== email
          || !result.data.user.email_confirmed_at) fail('uncertain');
    }
    const result = await admin.generateLink({ type, email, options: { redirectTo: DEV_CALLBACK } });
    if (result?.error) fail('uncertain');
    const link = buildDevLink(result?.data, type, email, expectedId);
    // Sauver seulement l'UUID propre au run ; jamais properties, token ou réponse entière.
    await record(slot, { status: 'generated', id: result.data.user.id });
    await present(link);
    await record(slot, { status: 'presented', id: result.data.user.id });
    return { status: 'presented', actor, type };
  } catch { fail('uncertain'); }
}
