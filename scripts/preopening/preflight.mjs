// Préparation hors ligne uniquement. Aucun client Supabase, transport ou mutation.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateTarget } from '../auth-link-local.mjs';

export const POLICY = JSON.parse(readFileSync(new URL('./policy.json', import.meta.url), 'utf8'));
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requireThat(condition, code) { if (!condition) throw new Error(code); }
export function instant(value) {
  requireThat(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value)), 'date');
  return Date.parse(value);
}
export function fresh(value, now, maximumMs) {
  const delta = instant(now) - instant(value);
  requireThat(delta >= 0 && delta <= maximumMs, 'stale_evidence');
}
export function target(value) {
  requireThat(value && ['local', 'development', 'production'].includes(value.environment), 'environment');
  const refs = { local: 'mon-bprea-lot6-1-local', development: 'wcckbyhrtroittbfophv', production: 'oqoqrxwfbkhtpksqimgd' };
  requireThat(value.projectRef === refs[value.environment], 'project');
  const site = new URL(value.siteUrl);
  requireThat(value.siteUrl === site.href && !site.username && !site.password && !site.search && !site.hash && site.pathname === '/mon-bprea/'
    && (value.environment === 'production' ? site.protocol === 'https:' && site.hostname === 'vladoche.github.io'
      : site.origin === 'http://127.0.0.1:4173'), 'callback');
  requireThat(value.callback === new URL('authentification.html', value.siteUrl).href, 'callback');
  return { environment: value.environment, projectRef: value.projectRef, siteUrl: site.href, callback: value.callback };
}
export function emptyPrivateConfiguration() {
  return {
    version: 1, operatorIdentity: null, capacityConfirmed: false,
    contact: { email: null, publicationApproved: false, owned: false, protected: false, recoveryChecked: false, withoutAccountChecked: false, receivedAt: null, repliedAt: null },
    approvals: { legalFramework: false, legalBases: false, impactAssessment: false, terminal: false, notice: false, residualRetention: false, recoveryLimits: false },
  };
}
export function contactCheck(config, now) {
  const missing = [];
  try { validateTarget('invite', config?.contact?.email); } catch { missing.push('real_email'); }
  for (const key of ['publicationApproved', 'owned', 'protected', 'recoveryChecked', 'withoutAccountChecked'])
    if (config?.contact?.[key] !== true) missing.push(`contact_${key}`);
  for (const key of ['receivedAt', 'repliedAt']) {
    try { fresh(config?.contact?.[key], now, 30 * 86400_000); } catch { missing.push(`contact_${key}`); }
  }
  if (config?.contact?.receivedAt && config?.contact?.repliedAt
      && Date.parse(config.contact.repliedAt) < Date.parse(config.contact.receivedAt)) missing.push('contact_order');
  return { status: missing.length ? 'BLOQUÉ — INFORMATION EXPLOITANT' : 'CANAL RENSEIGNÉ — PREUVES PRIVÉES À CONTRÔLER', missing };
}
function checkInventory(input, now) {
  const expected = target(input.target);
  requireThat(input.inventory?.projectRef === expected.projectRef, 'inventory_project');
  fresh(input.inventory.observedAt, now, 5 * 60_000);
  requireThat(input.inventory.complete === true && Array.isArray(input.inventory.accounts) && input.inventory.accounts.length <= 100, 'inventory_incomplete');
  const ids = new Set(), emails = new Set();
  for (const account of input.inventory.accounts) {
    requireThat(uuid.test(account.id) && !ids.has(account.id), 'inventory_identity');
    const email = validateTarget('invite', account.email);
    requireThat(!emails.has(email) && ['participant', 'operator', 'fixture'].includes(account.kind)
      && ['pending', 'active', 'uncertain'].includes(account.state) && account.privileged === false, 'inventory_account');
    ids.add(account.id); emails.add(email);
  }
  requireThat(input.inventory.accounts.filter(a => a.kind === 'operator').length <= 1, 'operator_count');
  requireThat(input.inventory.publicSignup === false && input.inventory.anonymousSignIn === false, 'signup_not_closed');
  return expected;
}
export function invitationPreflight(input, config, now) {
  const expected = checkInventory(input, now);
  requireThat(config.capacityConfirmed === true, 'capacity_unconfirmed');
  requireThat(input.inventory.accounts.every(a => a.kind !== 'fixture'), 'fixtures_require_separate_D');
  requireThat(input.inventory.accounts.every(a => a.state !== 'uncertain') && ['none', 'verified-no-mutation'].includes(input.previousResult), 'uncertain_no_retry');
  requireThat(['invite', 'recovery'].includes(input.type) && input.requestedRole === 'participant', 'operation');
  const email = validateTarget(input.type, input.recipient);
  const existing = input.inventory.accounts.find(a => a.email.toLowerCase() === email);
  const operatorReserved = input.inventory.accounts.some(a => a.kind === 'operator') ? 0 : 1;
  const occupied = input.inventory.accounts.length + operatorReserved;
  requireThat(input.type === 'invite' ? !existing : existing?.state === 'active', 'account_state');
  if (input.type === 'invite') requireThat(occupied < POLICY.capacity.total, 'capacity_full');
  requireThat(contactCheck(config, now).missing.length === 0 && Boolean(config.operatorIdentity?.trim()), 'contact_or_identity');
  requireThat(Object.values(emptyPrivateConfiguration().approvals).length === Object.keys(config.approvals || {}).length
    && Object.keys(emptyPrivateConfiguration().approvals).every(key => config.approvals[key] === true), 'approvals');
  requireThat(input.noticeProvidedBeforeEmail === true && input.directRequest === true && input.emailConfirmed === true
    && typeof input.noticeVersion === 'string' && input.noticeVersion.length > 0 && input.identityChecked === true, 'prior_information');
  // Aucun lien généré ni place réservée : relecture/lock/réservation nécessaires au futur exécuteur.
  return { status: 'PRÉFLIGHT HORS LIGNE CONFORME — AUCUNE GÉNÉRATION AUTORISÉE', ...expected,
    type: input.type, occupiedIncludingOperator: occupied, capacity: POLICY.capacity.total,
    enforcement: 'administrative', targetChecked: true, snapshotHash: digest(input),
    requires: ['separate_hosted_authorization', 'fresh_inventory', 'exclusive_operator_lock', 'durable_reservation_before_send', 'private_handoff_no_retry_on_uncertain'] };
}
export function closurePreflight(input, now) {
  const expected = checkInventory(input, now);
  requireThat(uuid.test(input.userId) && input.confirmUserId === input.userId, 'exact_uuid');
  requireThat(input.inventory.accounts.filter(a => a.id === input.userId).length === 1, 'account_missing');
  requireThat(input.inventory.accounts.find(a => a.id === input.userId).kind !== 'fixture', 'fixtures_require_separate_D');
  requireThat(input.identityChecked === true && input.requestConfirmed === true && input.exportOffered === true, 'identity_or_request');
  requireThat(['none', 'verified-no-mutation'].includes(input.previousResult), 'uncertain_read_before_retry');
  requireThat(input.inventory.dependenciesChecked === true && input.inventory.cascadeCount === 11
    && input.inventory.storageObjectsForTarget === 0, 'dependencies_or_storage');
  requireThat(Object.keys(input.inventory.targetRows || {}).sort().join() === [...POLICY.tables].sort().join()
    && Object.values(input.inventory.targetRows).every(n => Number.isSafeInteger(n) && n >= 0), 'ten_tables');
  requireThat(input.sessionsPlan === 'native-delete-refresh-expiry-check' && input.cachesPlan === 'assisted-per-device'
    && input.backupsPlan === 'reconcile-before-restore' && input.failurePlan === 'stop-read-state-no-blind-retry', 'residual_plans');
  return { status: 'PRÉFLIGHT HORS LIGNE CONFORME — AUCUNE SUPPRESSION AUTORISÉE', ...expected,
    targetChecked: true, tablesChecked: POLICY.tables.length, snapshotHash: digest(input),
    requires: ['separate_hosted_authorization', 'fresh_target_check', 'native_admin_delete_one_uuid', 'postcheck_auth_ten_tables_other_accounts', 'jwt_window_caches_backups_followup'] };
}
