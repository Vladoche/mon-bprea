// Render the reviewed source once; --check prevents a stale public notice in CI/release.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { noticeHtml } from './preopening/notice-preview.mjs';

const source = readFileSync(new URL('../docs/rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const target = new URL('../confidentialite.html', import.meta.url);
const rendered = noticeHtml(source, { preview: false });
if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--check')) throw new Error('Utiliser --check ou aucun argument.');
if (process.argv[2] === '--check') {
  if (readFileSync(target, 'utf8').replaceAll('\r\n', '\n') !== rendered) throw new Error('Notice publique périmée : relancer npm run build:privacy-notice.');
} else writeFileSync(target, rendered);
console.log(`Notice V1.1 · SHA-256 LF : ${createHash('sha256').update(source).digest('hex')}`);
