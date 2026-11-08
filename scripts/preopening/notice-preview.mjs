// La source et les rendus restent hors des racines Pages.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join, basename } from 'node:path';

export function noticeHtml(markdown, { preview = true } = {}) {
  const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const inline = text => escape(text).replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+|mailto:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const sections = [];
  const blocks = markdown.trim().split(/\r?\n\s*\r?\n/).map(block => {
    const heading = block.match(/^(#{1,2}) (.+)$/);
    if (heading?.[1] === '#') return `<h1>${inline(heading[2])}</h1>`;
    if (heading) {
      const label = heading[2];
      const id = label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      sections.push({ id, label });
      return `<h2 id="${id}" tabindex="-1">${inline(label)}</h2>`;
    }
    const lines = block.split(/\r?\n/);
    if (lines.every(line => line.startsWith('- '))) return `<ul>${lines.map(line => `<li>${inline(line.slice(2))}</li>`).join('')}</ul>`;
    return `<p>${inline(lines.join(' '))}</p>`;
  });
  const firstSection = blocks.findIndex(block => block.startsWith('<h2 '));
  if (firstSection !== -1) {
    const links = sections.map(({ id, label }) => `<li><a href="#${id}">${inline(label)}</a></li>`).join('\n');
    blocks.splice(firstSection, 0, `<nav aria-label="Sommaire"><strong>Dans cette notice</strong><ul>${links}</ul></nav>`);
  }
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  ${preview ? '<meta name="robots" content="noindex,nofollow">' : ''}
  <title>Notice de confidentialité · Mon BPREA${preview ? ' · Aperçu local' : ''}</title>
  ${preview ? '' : `<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <script src="assets/theme-init.js"></script>
  <link rel="stylesheet" href="assets/style.css">
  <link rel="stylesheet" href="assets/contact.css">`}
  <style>
    :root {
      color-scheme:light dark;
      --background: #f7f9f2;
      --surface: #fff;
      --text: #24372a;
      --green: #184e39;
      --border: #a5baaa;
      font: 1rem/1.65 system-ui, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme]) {
        --background: #121b15;
        --surface: #1b2920;
        --text: #e0eade;
        --green: #a6d4af;
        --border: #698673;
      }
    }
    body { margin: 0; background: var(--background); color: var(--text); }
    .wrap { width: min(44rem, calc(100% - 2rem)); margin-inline: auto; }
    header { padding-block: .85rem; background: var(--surface); border-bottom: 1px solid var(--border); }
    header p { margin-block: 0; color: var(--green); font-weight: 750; }
    main { padding-block: 1.25rem 3rem; overflow-wrap: anywhere; }
    h1, h2 { color: var(--green); line-height: 1.2; }
    h1 { font-size: clamp(1.8rem, 5vw, 2.65rem); margin-block: .8em .3em; }
    h2 { font-size: 1.35rem; margin-block: 1.8em .5em; scroll-margin-block: 1rem; }
    h1 + p { font-size: .95rem; }
    a { color: var(--green); text-underline-offset: .18em; }
    :focus-visible { outline: 3px solid var(--green); outline-offset: 3px; }
    ul { padding-inline-start: 1.45rem; }
    li + li { margin-block-start: .5rem; }
    main nav, aside { border: 1px solid var(--border); border-radius: .65rem; background: var(--surface); padding: 1rem; }
    main nav ul { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); gap: .5rem 1rem; margin-block-end: 0; }
    main nav li { margin-block-start: 0; }
    aside { border-inline-start: .25rem solid var(--green); }
    .skip { position: absolute; inset: .5rem auto auto .5rem; padding: .5rem 1rem; background: var(--surface); transform: translateY(-200%); }
    .skip:focus { transform: none; }
    ${preview ? '' : `:root { --background: var(--bg); --surface: var(--white); --border: var(--line); --text: var(--color-text); --green: var(--color-accent); }
    .notice-links { display: flex; flex-wrap: wrap; gap: .4rem 1.25rem; margin-block-start: .5rem; }
    .notice-links a { display: inline-block; padding-block: .3rem; }
    footer { border-top: 1px solid var(--border); padding-block: 1rem; }
    @media print { header, footer, .skip { display: none; } }`}
  </style>
</head>
<body>
  <a class="skip" href="#contenu">Aller au contenu</a>
  <header><div class="wrap"><p>Mon BPREA · Espace de révision</p>${preview ? '' : '<nav class="notice-links" aria-label="Navigation principale"><a href="index.html">Accueil</a><a href="mes-cours.html">Mes cours</a><a href="connexion.html">Connexion</a><a href="contact.html">Contact et assistance</a></nav>'}</div></header>
  <main class="wrap" id="contenu" tabindex="-1">
    ${preview ? '<aside role="note"><strong>Aperçu local de la version 1.1.</strong> Le fond de la version 1.0 a été approuvé le 5 novembre 2026. Les modifications et la publication restent à approuver.</aside>' : ''}
    ${blocks.join('\n    ')}
  </main>
  ${preview ? '' : '<footer><div class="wrap notice-links"><a href="contact.html">Contact et assistance</a><a href="confidentialite.html">Confidentialité</a></div></footer>'}
</body>
</html>
`.replace(/^[ \t]+$/gm, '');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    // Les protections de l'aperçu privé ne sont utiles qu'à cette commande.
    // Le rendu public doit fonctionner sans SDK ni outils administratifs installés.
    const [{ protectDirectory }, { checkDirectory }, { requireThat }] = await Promise.all([
      import('../dev-recipe/private-files.mjs'), import('./backup.mjs'), import('./preflight.mjs'),
    ]);
    requireThat(process.argv.length === 2, 'arguments');
    const root = fileURLToPath(new URL('../../', import.meta.url)), temporary = join(root, '.tmp');
    checkDirectory(temporary);
    const output = mkdtempSync(join(temporary, 'preopening-notice-preview-'));
    protectDirectory(output);
    writeFileSync(join(output, 'confidentialite.html'), noticeHtml(readFileSync(join(root, 'docs/rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md'), 'utf8')), { flag: 'wx', mode: 0o600 });
    process.stdout.write(`Aperçu créé sous .tmp/${basename(output)}/confidentialite.html\n`);
  } catch { process.stderr.write('Aperçu refusé : dossier neuf privé requis.\n'); process.exitCode = 2; }
}
