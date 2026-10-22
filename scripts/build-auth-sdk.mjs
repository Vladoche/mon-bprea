// Un seul fichier navigateur local : ni npm ni CDN requis sur GitHub Pages.
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const sdk = JSON.parse(await readFile(new URL('node_modules/@supabase/supabase-js/package.json', root), 'utf8'));
const license = await readFile(new URL('node_modules/@supabase/supabase-js/LICENSE', root), 'utf8');
await mkdir(new URL('assets/vendor/', root), { recursive: true });
await build({
  stdin: { contents: "export { createClient } from '@supabase/supabase-js';", resolveDir: fileURLToPath(root) },
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true,
  legalComments: 'eof', outfile: fileURLToPath(new URL('assets/vendor/supabase.js', root)),
  banner: { js: `// @supabase/supabase-js ${sdk.version} — généré par npm run build:auth-sdk\n/*\n${license}\n*/` },
});
await writeFile(new URL('assets/vendor/supabase-LICENSE.txt', root), license);
console.log(`SDK Supabase ${sdk.version} préparé dans assets/vendor/supabase.js`);
