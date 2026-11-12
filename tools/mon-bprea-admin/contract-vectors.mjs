// Synthetic fixtures evaluated by the existing Node implementation, never network.
// The C# test runner consumes this output to verify compatibility independently.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PROD_API, PROD_CALLBACK, validateProdTarget } from '../../scripts/prod-auth/environment.mjs';
import { buildProdManualLink, inspectProdAuthSettings, inspectProdAccounts } from '../../scripts/prod-auth/generator.mjs';

if (process.argv.length !== 3) throw new Error('Usage: node contract-vectors.mjs OUTPUT.json');
const email = 'participant@example.test';
const token = 'synthetic_token_without_any_auth_capability';
const user = { id: '11111111-1111-4111-8111-111111111111', email,
  created_at: '2026-11-01T10:00:00Z', email_confirmed_at: null };
const settings = { disable_signup: true, mailer_autoconfirm: false,
  external: { email: true, anonymous_users: false, phone: false } };
const result = { version: 1, email, emailCases: [], linkCases: [], settingsCases: [], inventoryCases: [] };

for (const input of [email, ' PARTICIPANT@EXAMPLE.TEST ', 'a+b@example.test', "a!#$%&'*+/=?^_`{|}~@example.test",
  '', 'a@localhost', '.a@example.test', 'a.@example.test', 'a..b@example.test',
  'Nom <a@example.test>', 'a@example.test,b@example.test', 'a\n@example.test', 'a\u001b@example.test',
  'é@example.test', 'a@-example.test', 'a@example-.test', 'a@example..test',
  'a'.repeat(65) + '@example.test', 'a@' + 'b'.repeat(64) + '.test',
  'a@b.c', 'a@xn--exmple-cua.test']) {
  try { result.emailCases.push({ input, valid: true, normalized: validateProdTarget('invite', input) }); }
  catch { result.emailCases.push({ input, valid: false }); }
}

function linkData() {
  const action = new URL(`${PROD_API}/auth/v1/verify`);
  action.searchParams.set('token', token);
  action.searchParams.set('type', 'invite');
  action.searchParams.set('redirect_to', PROD_CALLBACK);
  return { user: { ...user }, properties: { verification_type: 'invite', hashed_token: token,
    redirect_to: PROD_CALLBACK, action_link: action.href } };
}
const mutations = [
  ['valid', () => {}],
  ['wrong email', data => { data.user.email = 'other@example.test'; }],
  ['invalid uuid', data => { data.user.id = 'invalid'; }],
  ['uuid trailing newline', data => { data.user.id += '\n'; }],
  ['uuid version 7', data => { data.user.id = '11111111-1111-7111-8111-111111111111'; }],
  ['wrong type', data => { data.properties.verification_type = 'recovery'; }],
  ['short token', data => { data.properties.hashed_token = 'short'; }],
  ['wrong callback', data => { data.properties.redirect_to = 'https://example.test/'; }],
  ['wrong action origin', data => { data.properties.action_link = data.properties.action_link.replace(PROD_API, 'https://example.test'); }],
  ['action fragment', data => { data.properties.action_link += '#'; }],
  ['duplicate type', data => { data.properties.action_link += '&type=invite'; }],
  ['extra parameter', data => { data.properties.action_link += '&next=https://example.test'; }],
  ['wrong action token', data => { data.properties.action_link = data.properties.action_link.replace(token, 'other_synthetic_token_without_capability'); }],
  ['wrong action type', data => { data.properties.action_link = data.properties.action_link.replace('type=invite', 'type=recovery'); }],
  ['wrong action callback', data => { const url = new URL(data.properties.action_link); url.searchParams.set('redirect_to', 'https://example.test/'); data.properties.action_link = url.href; }],
  ['missing properties', data => { delete data.properties; }],
];
for (const [name, mutate] of mutations) {
  const data = linkData(); mutate(data);
  try { result.linkCases.push({ name, data, valid: true, link: buildProdManualLink(data, { type: 'invite', email }) }); }
  catch { result.linkCases.push({ name, data, valid: false }); }
}
for (const [name, data] of [
  ['closed email only', settings], ['empty', {}], ['null', null],
  ['signup open', { ...settings, disable_signup: false }],
  ['autoconfirm', { ...settings, mailer_autoconfirm: true }],
  ['missing anonymous', { ...settings, external: { email: true } }],
  ['anonymous enabled', { ...settings, external: { email: true, anonymous_users: true } }],
  ['github enabled', { ...settings, external: { ...settings.external, github: true } }],
  ['unknown disabled', { ...settings, external: { ...settings.external, unknown: false } }],
  ['anonymous alias true', { ...settings, anonymous_users_enabled: true }],
]) {
  try { await inspectProdAuthSettings({ getSettings: async () => data }); result.settingsCases.push({ name, data, valid: true }); }
  catch { result.settingsCases.push({ name, data, valid: false }); }
}
const users = count => Array.from({ length: count }, (_, index) => ({ ...user,
  id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
  email: index === 0 ? 'operator@example.test' : `participant-${index}@example.test`,
  email_confirmed_at: index % 2 ? null : '2026-11-01T10:00:00Z' }));
for (const [name, accounts] of [
  ['none', []], ['operator only', users(1)], ['confirmed and pending', users(4)], ['seven', users(7)],
  ['eight', users(8)], ['incomplete', null], ['duplicate identity', [user, { ...user }]],
  ['duplicate email', [user, { ...user, id: '22222222-2222-4222-8222-222222222222', email: email.toUpperCase() }]],
  ['invalid address', [{ ...user, email: 'malformed' }]], ['invalid identity', [{ ...user, id: 'invalid' }]],
  ['identity trailing newline', [{ ...user, id: user.id + '\n' }]],
]) {
  try {
    const inventory = await inspectProdAccounts({ listUsers: async () => ({ data: { users: accounts } }) }, email);
    result.inventoryCases.push({ name, users: accounts, valid: true, count: inventory.count });
  } catch { result.inventoryCases.push({ name, users: accounts, valid: false }); }
}
const output = resolve(process.argv[2]);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(`Synthetic Node contract vectors: ${Object.values(result).filter(Array.isArray).reduce((sum, list) => sum + list.length, 0)} cases.\n`);
