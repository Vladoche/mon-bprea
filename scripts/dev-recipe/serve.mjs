// Serveur privé silencieux : ne jamais journaliser la query d'un callback Auth.
import { createServer } from 'node:http';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { DEV_SITE, fail, publicConfiguration } from './contract.mjs';

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
export function createRecipeServer(dir, key) {
  const root = join(dir, 'frontend', 'mon-bprea'), files = new Map();
  const expected = publicConfiguration(key);
  if (JSON.stringify(JSON.parse(readFileSync(join(root, 'assets', 'auth-config.json'), 'utf8'))) !== JSON.stringify(expected)) fail('artifact');
  function inventory(folder, prefix = '') {
    if (lstatSync(folder).isSymbolicLink()) fail('artifact');
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (entry.name === '.nojekyll') continue;
      if (entry.isSymbolicLink() || entry.name.startsWith('.')) fail('artifact');
      const name = prefix + entry.name, path = join(folder, entry.name);
      if (entry.isDirectory()) {
        if (!['assets', 'documents'].includes(name.split('/')[0])) fail('artifact');
        inventory(path, `${name}/`);
      } else if (entry.isFile()) {
        if (!name.includes('/') && !name.endsWith('.html')) fail('artifact');
        const extension = name.slice(name.lastIndexOf('.'));
        if (!mime[extension]) fail('artifact');
        files.set(`/mon-bprea/${name}`, { path, type: mime[extension] });
      } else fail('artifact');
    }
  }
  inventory(root);
  return createServer((req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      const url = new URL(req.url, DEV_SITE);
      const path = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
      const file = files.get(path);
      if (!file) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': file.type, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : readFileSync(file.path));
    } catch { res.writeHead(500).end(); }
  });
}
