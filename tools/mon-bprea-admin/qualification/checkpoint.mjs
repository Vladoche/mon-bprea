// Preserve a verified local qualification across a collector restart.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { readPersonalTables } from '../../../tests/helpers/personal-data-local.js';
const directory = resolve('.tmp/mon-bprea-admin-v2/private');
const state = JSON.parse(readFileSync(join(directory, 'session.private.json'), 'utf8'));
assert.equal(state.api, 'http://127.0.0.1:54321');
const verified = await fetch('http://127.0.0.1:54329/verify-preserved', { method: 'POST', headers: { 'X-Qualification-ID': state.id } });
assert.equal(verified.status, 200, 'Live original baselines must still match');
for (const [name, fixture] of [['a', state.participant], ['witness', state.witness]]) {
  const client = createClient(state.api, state.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const refresh = async () => { const result = await client.auth.signInWithPassword({ email: fixture.email, password: fixture.password }); assert.equal(result.error, null); };
  await refresh();
  const rows = await readPersonalTables({ client, userId: fixture.userId, refresh });
  writeFileSync(join(directory, `baseline-${name}.private.json`), JSON.stringify(rows), { flag: 'wx', mode: 0o600 });
}
console.log('PASS local checkpoint: original A/B baselines verified, no history reset.');
