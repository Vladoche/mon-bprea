// Render the versioned source; --check runs the same checks in CI and before publication.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { noticeHtml } from './preopening/notice-preview.mjs';
import { checkPrivacyNotice } from './preopening/notice-checks.mjs';

const source = readFileSync(new URL('../docs/rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const target = new URL('../confidentialite.html', import.meta.url);
const rendered = noticeHtml(source, { preview: false });
if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--check')) throw new Error('Utiliser --check ou aucun argument.');
checkPrivacyNotice(source, rendered);
if (process.argv[2] === '--check') {
  if (readFileSync(target, 'utf8').replaceAll('\r\n', '\n') !== rendered) throw new Error('Notice publique périmée : relancer npm run build:privacy-notice.');
} else writeFileSync(target, rendered);
console.log(`Notice · SHA-256 LF : ${createHash('sha256').update(source).digest('hex')}`);
