import { afterEach, describe, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { complete, preflight } from '../../scripts/maintenance/git-delivery.mjs';

const roots = [];
const branch = 'codex/synthetic-delivery';
const options = { confirmed: true, processes: () => ({ available: true, busy: false }), write: () => {} };

function git(repository, ...args) {
  return execFileSync('git', ['-C', repository, '-c', 'user.name=Synthetic',
    '-c', 'user.email=synthetic@example.invalid', '-c', 'commit.gpgsign=false',
    '-c', 'core.hooksPath=.git/no-hooks', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function fixture() {
  mkdirSync(resolve('.tmp'), { recursive: true });
  const root = mkdtempSync(resolve('.tmp/git-delivery-test-'));
  roots.push(root);
  const repository = join(root, 'checkout'), remote = join(root, 'remote.git');
  mkdirSync(repository);
  mkdirSync(remote);
  git(repository, 'init', '-b', 'main');
  git(remote, 'init', '--bare', '-b', 'main');
  writeFileSync(join(repository, '.gitignore'), '.tmp/\nlocal.private\n');
  git(repository, 'add', '.gitignore');
  git(repository, 'commit', '-m', 'Base');
  git(repository, 'remote', 'add', 'origin', remote);
  git(repository, 'push', '-u', 'origin', 'main');
  const worktree = join(repository, '.tmp', 'worktrees', 'synthetic-delivery');
  git(repository, 'worktree', 'add', '-b', branch, worktree, 'origin/main');
  writeFileSync(join(worktree, 'change.txt'), 'Delivered content');
  git(worktree, 'add', 'change.txt');
  git(worktree, 'commit', '-m', 'Delivery');
  return { repository, remote, worktree };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    expect(dirname(realpathSync(root))).toBe(realpathSync(resolve('.tmp')));
    rmSync(root, { recursive: true });
  }
});

describe('hygiène Git de livraison', () => {
  test('signale les changements, les commits locaux et les opérations en cours', () => {
    const { worktree } = fixture();
    writeFileSync(join(worktree, 'untracked.txt'), 'Unknown content');
    writeFileSync(resolve(worktree, git(worktree, 'rev-parse', '--git-path', 'MERGE_HEAD')), git(worktree, 'rev-parse', 'HEAD'));
    const output = [];
    preflight(worktree, value => output.push(value));
    expect(output.join('\n')).toMatch(/\?\? untracked\.txt[\s\S]*Delivery[\s\S]*MERGE_HEAD/);
  });

  test('conserve un commit non poussé, même si un suivi distant périmé le référence', () => {
    const { repository, worktree, remote } = fixture();
    git(worktree, 'push', '-u', 'origin', branch);
    git(remote, 'update-ref', '-d', `refs/heads/${branch}`);
    expect(git(worktree, 'rev-parse', '@{upstream}')).toBe(git(worktree, 'rev-parse', 'HEAD'));
    expect(() => complete(repository, { ...options, retire: branch })).toThrow('absente des références distantes');
    expect(existsSync(worktree)).toBe(true);
    expect(git(repository, 'branch', '--list', branch)).toContain(branch);
  });

  test('préserve les fichiers ignorés et retire uniquement le worktree propre confirmé', () => {
    const { repository, worktree, remote } = fixture();
    git(worktree, 'push', '-u', 'origin', branch);
    writeFileSync(join(repository, 'other-session.txt'), 'Other session');
    const ignored = join(worktree, 'local.private');
    writeFileSync(ignored, 'Keep local file');
    complete(worktree, options);
    expect(() => complete(repository, { ...options, retire: branch })).toThrow('éléments locaux');
    expect(existsSync(ignored)).toBe(true);
    unlinkSync(ignored);
    git(worktree, 'update-index', '--assume-unchanged', 'change.txt');
    expect(() => complete(repository, { ...options, retire: branch })).toThrow('index masqué');
    git(worktree, 'update-index', '--no-assume-unchanged', 'change.txt');
    complete(repository, { ...options, retire: branch });
    expect(existsSync(worktree)).toBe(false);
    expect(git(repository, 'branch', '--list', branch)).toBe('');
    expect(git(remote, 'show', `${branch}:change.txt`)).toBe('Delivered content');
    expect(existsSync(join(repository, 'other-session.txt'))).toBe(true);
  }, 20_000);
});
