// Aperçu local, sans intégration au site. Source unique : projet de notice existant.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join, basename } from 'node:path';
import { protectDirectory } from '../dev-recipe/private-files.mjs';
import { checkDirectory } from './backup.mjs';
import { requireThat } from './preflight.mjs';

export function noticeHtml(markdown) {
  const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const inline = text => escape(text).replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+|mailto:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const body = markdown.trim().split(/\r?\n\s*\r?\n/).map(block => {
    const heading = block.match(/^(#{1,3}) (.+)$/);
    return heading ? `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>` : `<p>${inline(block.replace(/\r?\n/g, ' '))}</p>`;
  }).join('\n');
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"><title>Notice Mon BPREA — aperçu local</title><style>:root{color-scheme:light dark;font:18px/1.65 system-ui}body{margin:0 auto;padding:24px;max-width:760px;overflow-wrap:anywhere}h1{font-size:1.8rem;line-height:1.25}h2{font-size:1.25rem;margin-top:2rem}a{color:light-dark(#165a3b,#9ae8bc)}a:focus-visible{outline:3px solid;outline-offset:4px}aside{border:2px solid;padding:16px}p{margin:1rem 0}</style><body><aside role="note">APERÇU LOCAL NON APPROUVÉ — mentions manquantes à compléter avant toute publication ou collecte d’adresse.</aside><main>${body}</main></body></html>`;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    requireThat(process.argv.length === 2, 'arguments');
    const root = fileURLToPath(new URL('../../', import.meta.url)), temporary = join(root, '.tmp');
    checkDirectory(temporary);
    const output = mkdtempSync(join(temporary, 'preopening-notice-preview-'));
    protectDirectory(output);
    writeFileSync(join(output, 'notice.html'), noticeHtml(readFileSync(join(root, 'docs/rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md'), 'utf8')), { flag: 'wx', mode: 0o600 });
    process.stdout.write(`Aperçu créé sous .tmp/${basename(output)}/notice.html ; aucune page racine ou activation.\n`);
  } catch { process.stderr.write('Aperçu refusé : dossier neuf privé requis.\n'); process.exitCode = 2; }
}
