import { readFileSync, readdirSync, statSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const publicRoot = new URL('https://vladoche.github.io/mon-bprea/');
const noticeUrl = new URL('confidentialite.html', publicRoot);
const read = path => readFileSync(new URL(path, root), 'utf8');
const ids = html => [...html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id);
const dates = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' });

function requireNotice(condition, message) {
  if (!condition) throw new Error('Notice : ' + message);
}

function checkLinks(source, html) {
  const anchors = ids(html);
  requireNotice(new Set(anchors).size === anchors.length, 'ancres HTML dupliquées.');
  for (const [, href] of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const url = URL.parse(href.replaceAll('&amp;', '&'), noticeUrl);
    requireNotice(url && !url.username && !url.password && !/\s/.test(href) &&
      (url.protocol === 'https:' || /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/.test(href)),
    'lien mal formé ou protocole non autorisé.');
    if (url.origin !== publicRoot.origin) continue;
    requireNotice(url.pathname.startsWith(publicRoot.pathname), 'lien hors du site Pages.');
    const path = url.pathname.slice(publicRoot.pathname.length) || 'index.html';
    const file = decodeURIComponent(path);
    requireNotice(!file.split('/').some(part => part.startsWith('.')) &&
      (/^[^/]+\.html$/.test(file) || /^assets\/.+/.test(file) || /^documents\/.+\.pdf$/.test(file)),
    'cible locale hors du périmètre public.');
    const content = file === 'confidentialite.html' ? html : null;
    requireNotice(content || statSync(new URL(path, root), { throwIfNoEntry: false })?.isFile(),
      'cible locale introuvable : ' + file);
    if (url.hash) {
      requireNotice(ids(content ?? read(path)).includes(decodeURIComponent(url.hash.slice(1))),
        'ancre locale introuvable : ' + url.hash);
    }
  }
  for (const [, href] of source.matchAll(/\[[^\]\n]*\]\(([^)\n]*)\)/g)) {
    const escaped = href.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    requireNotice(html.includes('href="' + escaped + '" rel="noreferrer"'), 'lien Markdown non rendu.');
  }
  for (const file of readdirSync(root).filter(name => name.endsWith('.html'))) {
    if (file === 'confidentialite.html') continue;
    for (const [, anchor] of read(file).matchAll(/href="(?:\.\/)?confidentialite\.html#([^"]+)"/g)) {
      requireNotice(anchors.includes(decodeURIComponent(anchor)), 'ancre de notice liée depuis ' + file + ' introuvable.');
    }
  }
}

export function checkPrivacyNotice(source, html) {
  const [introduction, ...blocks] = source.split(/^## /m);
  const sections = new Map(blocks.map(block => {
    const newline = block.indexOf('\n');
    return [block.slice(0, newline).trim(), block.slice(newline + 1).trim()];
  }));
  const requiredSections = ['Responsable et contact', 'Compte et invitation', 'Finalités et base juridique',
    'Stockage sur votre appareil', 'Prestataires et transferts', 'Durées de conservation',
    'Sauvegardes et export', 'Vos droits et la clôture', 'Évolutions de la notice'];
  requireNotice(/^# .+\n\nVersion \d+\.\d+(?:\.\d+)? · \d{1,2} \p{L}+ \d{4}$/mu.test(introduction),
    'titre, version et date requis.');
  requireNotice(sections.size === blocks.length, 'rubriques dupliquées.');
  for (const title of requiredSections) {
    requireNotice(sections.get(title), 'rubrique manquante ou vide : ' + title);
  }

  const policy = JSON.parse(read('scripts/preopening/policy.json'));
  const admin = read('tools/mon-bprea-admin/Core/AdminContract.cs');
  const capacity = Number(admin.match(/\bMaximumAccounts = (\d+);/)?.[1]);
  requireNotice(capacity === policy.capacity.total &&
    new RegExp('\\b' + capacity + ' adultes au total\\b').test(introduction) &&
    new RegExp('\\b' + policy.capacity.otherParticipants + ' participants? invité').test(introduction),
  'capacité de la notice, du cadrage et d’Admin Windows incohérente.');
  const contact = 'mailto:' + policy.contact.email;
  requireNotice(sections.get('Responsable et contact').includes('](' + contact + ')') &&
    read('contact.html').includes('href="' + contact + '"'), 'contact officiel divergent.');
  const declared = [...sections.get('Finalités et base juridique').matchAll(/^- \*\*(R\d{2}) — /gm)].map(([, id]) => id);
  const registered = [...read('docs/rgpd/REGISTRE-TRAITEMENTS.md').matchAll(/^## (R\d{2}) — /gm)].map(([, id]) => id);
  requireNotice(registered.length && declared.sort().join() === registered.sort().join(), 'finalités différentes du registre.');
  const retention = JSON.parse(read('docs/rgpd/CONSERVATION-PROJET.json'));
  const calendar = retention.agreedCalendar;
  const deadlines = sections.get('Durées de conservation').toLowerCase().split('\n');
  for (const [date, description] of [[calendar.noticeAndExportStart, 'préavis'], [calendar.serviceClosesOn, 'fermeture'],
    [calendar.hostedDeletionTarget, 'suppression'], [retention.agreedResidualRetention.contactAvailableUntil, 'contact']]) {
    const formatted = dates.format(new Date(date + 'T00:00:00Z'));
    requireNotice(deadlines.some(line => line.startsWith('- ') && line.includes(description) && line.includes(formatted)),
      'date de ' + description + ' différente du calendrier.');
  }
  checkLinks(source, html);
}
