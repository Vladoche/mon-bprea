// Only public, committed bytes can qualify a legacy test build for removal.
// A manifest is an additional check, never a source of deletion paths.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const BUILD_NAME = /^e2e-[A-Za-z0-9]{6}$/;
export const MARKER = '.tmp-build.json';
export const KNOWN_GROUPS = new Set(['dev-recipe', 'lot653b-native', 'lot653b',
  'supabase-dev-config', 'maintenance-local']);

export function publicPath(name) {
  return /^(?:[A-Za-z0-9_-]+\.html|assets\/(?!.*(?:^|\/)\.)[A-Za-z0-9_ /.-]+\.(?:js|css|json|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf)|documents\/[^/\\\x00-\x1f]+\.pdf)$/.test(name)
    && !name.split('/').some(part => part === '..' || part === '.');
}

export function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

export function publicDigest(name, bytes, { cacheVersion } = {}) {
  if (/\.(?:html|js|css|json|svg)$/.test(name) && name !== 'assets/auth-config.json') {
    // prepare-pages adds only cache versions. Match historical sources as well.
    let text = bytes.toString('utf8').replaceAll('\r\n', '\n');
    if (/\.(?:html|js|css)$/.test(name)) text = text.replace(/(?:\?|&(?:amp;)?)v=([A-Za-z0-9._-]+)(?=[&#'"`\s)<>]|$)/g,
      (match, value) => !cacheVersion || value === cacheVersion ? '' : match);
    return digest(text);
  }
  if (name === 'assets/auth-config.json') {
    try {
      const value = JSON.parse(bytes.toString('utf8'));
      if (value.enabled !== false) return null;
      return digest(JSON.stringify(Object.fromEntries(Object.entries(value).sort())));
    } catch { return null; }
  }
  return digest(bytes);
}

export function referenceCatalog(files) {
  const paths = new Set(), hashes = new Set(), rawHashes = new Set();
  for (const { name, bytes } of files) {
    if (!publicPath(name)) continue;
    paths.add(name);
    rawHashes.add(digest(bytes));
    const hash = publicDigest(name, bytes);
    if (hash) hashes.add(hash);
  }
  return { paths, hashes, rawHashes };
}

export function gitCatalog(repository) {
  const options = { cwd: repository, windowsHide: true, maxBuffer: 128 * 1024 * 1024 };
  const list = execFileSync('git', ['rev-list', '--objects', '--all', '--', '*.html', 'assets', 'documents'], options)
    .toString('utf8').trim().split('\n').map(line => {
      const space = line.indexOf(' ');
      return { oid: line.slice(0, space), name: line.slice(space + 1) };
    }).filter(item => /^[a-f0-9]{40,64}$/.test(item.oid) && publicPath(item.name));
  const output = execFileSync('git', ['cat-file', '--batch'], {
    ...options, input: list.map(item => item.oid).join('\n') + '\n',
  });
  let offset = 0;
  const files = [];
  for (const item of list) {
    const end = output.indexOf(10, offset);
    const [, type, size] = output.subarray(offset, end).toString('ascii').split(' ');
    if (type !== 'blob' || !/^\d+$/.test(size)) throw new Error('reference-unavailable');
    offset = end + 1;
    files.push({ name: item.name, bytes: output.subarray(offset, offset + Number(size)) });
    offset += Number(size) + 1;
  }
  return referenceCatalog(files);
}
