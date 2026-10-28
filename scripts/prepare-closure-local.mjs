import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { getLocalSupabaseEnvironment } from '../tests/helpers/auth-local.js';
// Guard every endpoint and project before enabling the local prototype.
getLocalSupabaseEnvironment();
await writeFile('.env.closure-test.local', `BPREA_CLOSURE_MODE=ephemeral-local\nBPREA_CLOSURE_ORIGIN=http://127.0.0.1:4173\nBPREA_CLOSURE_RECEIPT_KEY=${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
console.log('Prototype de clôture préparé uniquement pour la stack éphémère dédiée.');
