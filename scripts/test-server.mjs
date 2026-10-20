// Serveur réservé aux tests : sources à /, artefact Pages versionné à /mon-bprea/.
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = join(root, '.tmp');
mkdirSync(temporary, { recursive: true });
if (realpathSync(temporary) !== temporary) throw new Error('Le dossier temporaire doit rester dans le dépôt.');
const runDirectory = mkdtempSync(join(temporary, 'e2e-'));
const published = join(runDirectory, 'public');
const prepared = spawnSync(process.env.PYTHON || 'python', [
  join(root, 'scripts', 'prepare-pages.py'), '--version', 'e2e-lot5-1', '--output', published,
], { encoding: 'utf8' });
if (prepared.error || prepared.status !== 0) {
  console.error(prepared.error?.message || prepared.stderr);
  process.exitCode = 1;
} else {
  const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.pdf': 'application/pdf', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
    '.woff': 'font/woff', '.woff2': 'font/woff2',
  };
  const server = createServer((request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const prefixed = pathname.startsWith('/mon-bprea/');
      const relative = (prefixed ? pathname.slice('/mon-bprea/'.length) : pathname.slice(1)) || 'index.html';
      const parts = relative.split('/');
      // Le serveur n'expose ni Git, ni node_modules, ni fixtures ou outils de développement.
      if (relative.includes('\\') || parts.some(part => part.startsWith('.')) ||
          !(parts.length === 1 && relative.endsWith('.html') || ['assets', 'documents'].includes(parts[0]))) {
        response.writeHead(404).end(); return;
      }
      const directory = prefixed ? published : root;
      const file = resolve(directory, relative);
      if (!file.startsWith(directory + sep) || !existsSync(file) || !statSync(file).isFile()) {
        response.writeHead(404).end(); return;
      }
      response.writeHead(200, {
        'Content-Type': mime[extname(file)] || 'application/octet-stream',
        'Content-Length': statSync(file).size,
        'Cache-Control': 'no-store',
      });
      if (request.method === 'HEAD') response.end();
      else createReadStream(file).pipe(response);
    } catch { response.writeHead(400).end(); }
  });
  server.listen(4173, '127.0.0.1', () => console.log('Tests locaux : http://127.0.0.1:4173/ et /mon-bprea/'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit()));
}

process.on('exit', () => {
  // Seul ce répertoire neuf est effacé, après vérification du chemin réel dans le workspace.
  if (existsSync(runDirectory) && realpathSync(runDirectory).startsWith(temporary + sep + 'e2e-')) {
    rmSync(runDirectory, { recursive: true, force: true });
  }
});
