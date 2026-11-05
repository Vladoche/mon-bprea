// Lifecycle of the one disposable public build created by test-server.mjs.
import * as fs from 'node:fs';
import { join } from 'node:path';
import { BUILD_NAME, MARKER } from './tmp-policy.mjs';
import { checkedPath, checkWindowsAttributes, scanTree, buildFingerprint, fail } from './tmp-inventory.mjs';

export function ownTestBuild(repository, directory) {
  checkedPath(repository, directory);
  const name = directory.slice(join(repository, '.tmp').length + 1);
  if (!BUILD_NAME.test(name) || directory !== join(repository, '.tmp', name)) fail('external-path');
  const tree = scanTree(repository, directory);
  if (tree.links.length || tree.errors.length) fail('unsafe-tree');
  const fingerprint = buildFingerprint(repository, directory, tree);
  const marker = JSON.stringify({ version: 1, kind: 'e2e-public-build', pid: process.pid, state: 'ready', treeHash: fingerprint.hash });
  fs.writeFileSync(join(directory, MARKER), marker, { flag: 'wx', mode: 0o600 });
  // The in-memory fingerprint, not the mutable marker, authorizes this cleanup.
  return () => {
    if (!fs.existsSync(directory)) return;
    checkedPath(repository, directory);
    checkWindowsAttributes(repository, directory);
    const current = scanTree(repository, directory);
    if (current.links.length || current.errors.length
      || JSON.stringify(current.directories) !== JSON.stringify(tree.directories)
      || current.files.filter(file => file.name !== MARKER).length !== tree.files.length
      || buildFingerprint(repository, directory, current).hash !== fingerprint.hash
      || fs.readFileSync(join(directory, MARKER), 'utf8') !== marker) fail('changed-since-inventory');
    for (const file of [...tree.files, { name: MARKER }]) fs.unlinkSync(checkedPath(repository, join(directory, file.name)));
    for (const folder of [...tree.directories].sort((a, b) => b.split('/').length - a.split('/').length)) {
      fs.rmdirSync(checkedPath(repository, join(directory, folder)));
    }
    fs.rmdirSync(checkedPath(repository, directory));
  };
}
