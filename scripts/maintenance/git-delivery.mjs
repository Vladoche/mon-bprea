import { execFileSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkedPath, checkWindowsAttributes, processSnapshot, scanTree } from './tmp-inventory.mjs';
import { BUILD_NAME } from './tmp-policy.mjs';
import { main as maintainTmp } from './tmp-prune.mjs';

const operationMarkers = [
  'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'REBASE_HEAD',
  'rebase-apply', 'rebase-merge', 'sequencer', 'BISECT_START', 'index.lock',
];

function git(repository, args, { allowed = [0], network = false } = {}) {
  try {
    return execFileSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', repository, ...args], {
      encoding: 'utf8', windowsHide: true, timeout: 45_000, maxBuffer: 16 * 1024 * 1024,
      env: network ? { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (allowed.includes(error.status)) return '';
    // Git's stderr can contain remote credentials or private paths.
    throw new Error(network ? 'origin inaccessible (git ls-remote).' : `Échec Git (${args[0]}).`);
  }
}

function operations(repository) {
  return operationMarkers.filter(marker => {
    const path = git(repository, ['rev-parse', '--git-path', marker]).trimEnd();
    try {
      lstatSync(resolve(repository, path));
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw new Error('Vérification des opérations Git indisponible.');
    }
  });
}

function status(repository, includeIgnored = false) {
  const args = ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none'];
  if (includeIgnored) args.push('--ignored=matching');
  return git(repository, args);
}

function hasHiddenIndexEntries(repository) {
  return git(repository, ['ls-files', '-v', '-z']).split('\0').some(entry => /^[Sa-z] /.test(entry));
}

export function preflight(repository, write = console.log) {
  const commands = [
    ['État et branche', ['status', '--short', '--branch', '--untracked-files=all']],
    ['Fichiers modifiés', ['diff', '--no-ext-diff', '--name-status']],
    ['Fichiers indexés', ['diff', '--cached', '--no-ext-diff', '--name-status']],
    ['Commits hors références distantes locales', ['log', '--oneline', '--branches', 'HEAD', '--not', '--remotes']],
    ['Worktrees', ['worktree', 'list', '--porcelain']],
  ];
  for (const [label, args] of commands) write(`${label}\n${git(repository, args).trimEnd() || 'Aucun.'}`);
  write(`Opérations Git en cours\n${operations(repository).join(', ') || 'Aucune.'}`);
}

function remoteHeads(repository, branch, base) {
  const refs = [base, branch].map(name => `refs/heads/${name}`);
  const output = git(repository, ['ls-remote', '--refs', 'origin', ...refs], { network: true });
  const shas = new Map(output.trimEnd().split('\n').filter(Boolean).map(line => line.split('\t').reverse()));
  return refs.map(ref => shas.get(ref));
}

function ancestor(repository, sha, remoteSha) {
  if (sha === remoteSha) return true;
  if (!remoteSha || !git(repository, ['cat-file', '-t', remoteSha], { allowed: [128] })) return false;
  return git(repository, ['merge-base', '--all', sha, remoteSha], { allowed: [1] }).split(/\r?\n/).includes(sha);
}

function worktrees(repository) {
  const output = git(repository, ['worktree', 'list', '--porcelain', '-z']);
  return output.split('\0\0').filter(Boolean).map(record => {
    const [location, ...details] = record.split('\0');
    return { path: location.slice('worktree '.length), details };
  });
}

function retireBranch(repository, branch, sha, { write, processes }) {
  const trees = worktrees(repository);
  const worktree = trees.find(tree => tree.details.includes(`branch refs/heads/${branch}`));
  if (worktree) {
    const primary = trees[0].path;
    const path = checkedPath(primary, worktree.path);
    if (dirname(path) !== resolve(primary, '.tmp', 'worktrees')) {
      throw new Error('Le worktree est en dehors du dossier des worktrees de livraison.');
    }
    if (path !== resolve(repository) && operations(path).length === 0) {
      const current = processes();
      if (!current.available || current.busy) throw new Error('Vérification des processus indisponible ou outils actifs.');
      checkWindowsAttributes(primary, path);
      const tree = scanTree(primary, path);
      if (tree.links.length || tree.errors.length || hasHiddenIndexEntries(path) || status(path, true)) {
        throw new Error('Le worktree contient des éléments locaux ou un index masqué.');
      }
      if (git(path, ['rev-parse', 'HEAD']).trim() !== sha) throw new Error('La tête du worktree a changé.');
      git(repository, ['worktree', 'remove', '--', path]);
      write('Worktree retiré.');
    } else {
      throw new Error('Quitter le worktree de la tâche et terminer toute opération Git en cours avant son retrait.');
    }
  }
  if (git(repository, ['rev-parse', '--verify', `refs/heads/${branch}`]).trim() !== sha) {
    throw new Error('La branche locale a changé.');
  }
  git(repository, ['branch', '-d', '--', branch]);
  write(`Branche locale retirée (${branch}).`);
}

export function complete(repository, {
  confirmed = false, base = 'main', retire, buildNames = new Set(), json = false,
  write = console.log, processes = processSnapshot,
} = {}) {
  const branch = retire ?? git(repository, ['branch', '--show-current']).trim();
  if (!confirmed) {
    write('Livraison en attente de confirmation. Aucun nettoyage.');
    preflight(repository, write);
    maintainTmp(json ? ['--json'] : [], { repository, write, processes, buildNames });
    return;
  }
  if (!branch || branch === base || branch === 'main') throw new Error('Une branche de travail dédiée est requise.');
  git(repository, ['check-ref-format', `refs/heads/${branch}`]);
  git(repository, ['check-ref-format', `refs/heads/${base}`]);
  const sha = git(repository, ['rev-parse', '--verify', `refs/heads/${branch}`]).trim();
  const [remoteBase, remoteBranch] = remoteHeads(repository, branch, base);
  if (!remoteBase || !git(repository, ['cat-file', '-t', remoteBase], { allowed: [128] })) {
    throw new Error('Référence distante de base indisponible localement. Actualiser origin.');
  }
  if (!ancestor(repository, sha, remoteBase) && !ancestor(repository, sha, remoteBranch)) {
    throw new Error('La tête locale est absente des références distantes vérifiées.');
  }
  write(`Commit conservé sur origin (${sha}).`);
  write(`Diff de livraison depuis l’ancêtre commun avec origin/${base}\n${git(repository, [
    'diff', '--no-ext-diff', '--stat', `${remoteBase}...${sha}`,
  ]).trimEnd() || 'Aucun.'}`);
  if (retire) {
    retireBranch(repository, branch, sha, { write, processes });
    maintainTmp(json ? ['--json'] : [], { repository, write, processes, buildNames });
    return;
  }
  const clean = () => !operations(repository).length && !hasHiddenIndexEntries(repository) && !status(repository)
    && git(repository, ['rev-parse', 'HEAD']).trim() === sha
    && git(repository, ['branch', '--show-current']).trim() === branch;
  if (!clean()) throw new Error('La tête a changé ou il reste des changements locaux ou une opération Git en cours.');
  const tmpArgs = json ? ['--json'] : [];
  if (buildNames.size) tmpArgs.push('--delivery');
  const report = maintainTmp(tmpArgs, { repository, write, processes, buildNames });
  const remaining = report.remainingGroups?.filter(group => buildNames.has(group.label)) ?? [];
  if (remaining.length) {
    throw new Error(`Builds ciblés conservés après contrôle (${remaining.map(group => group.label).join(', ')}).`);
  }
  if (!clean()) throw new Error('Le répertoire de travail a changé pendant le contrôle.');
  write('Répertoire de travail propre pour Git.');
}

function cli(args) {
  const repository = git(process.cwd(), ['rev-parse', '--show-toplevel']).trimEnd();
  if (args.length === 1 && args[0] === '--preflight') return preflight(repository);
  const options = { buildNames: new Set() };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--confirmed') options.confirmed = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--retire' || arg === '--base') {
      const value = args[++i];
      if (!value || value.startsWith('-')) throw new Error(`Valeur requise après ${arg}.`);
      options[arg.slice(2)] = value;
    } else if (arg === '--build' && BUILD_NAME.test(args[i + 1] ?? '')) {
      options.buildNames.add(args[++i]);
    } else {
      throw new Error('Argument invalide.');
    }
  }
  if ((options.retire || options.buildNames.size) && !options.confirmed || options.retire && options.buildNames.size) {
    throw new Error('Confirmer la livraison et traiter ses builds avant de retirer le worktree.');
  }
  // Keep diagnostics separate when forwarding the existing .tmp JSON report.
  if (options.json) {
    options.write = line => (line.startsWith('{') ? console.log(line) : console.error(line));
  }
  return complete(repository, options);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli(process.argv.slice(2));
  } catch (error) {
    console.error(`Fin de livraison interrompue. ${error.message}`);
    process.exitCode = 1;
  }
}
