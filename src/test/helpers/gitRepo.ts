/**
 * Test helpers for integration tests that need a real, isolated git repository.
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const TEMP_REPO_PREFIX = 'mdv-it-';

/**
 * Run a git command in the given repository and return its stdout.
 */
export function git(repoDir: string, ...args: string[]): string {
  // stderr is captured so that git's line-ending warnings do not clutter the test output
  return execFileSync('git', args, { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' });
}

/**
 * Create an empty git repository in a new temporary directory with a local identity.
 * Returns the canonical (symlink- and 8.3-name-free) path, as `git rev-parse` reports it.
 */
export function createTempRepo(): string {
  const repoDir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), TEMP_REPO_PREFIX)));
  git(repoDir, 'init', '--quiet');
  git(repoDir, 'config', 'user.name', 'Integration Test');
  git(repoDir, 'config', 'user.email', 'integration-test@example.invalid');
  git(repoDir, 'config', 'commit.gpgsign', 'false');
  return repoDir;
}

/**
 * Write a file into the repository and commit it.
 */
export function commitFile(repoDir: string, fileName: string, content: string): string {
  const filePath = path.join(repoDir, fileName);
  fs.writeFileSync(filePath, content);
  git(repoDir, 'add', fileName);
  git(repoDir, 'commit', '--quiet', '-m', `Add ${fileName}`);
  return filePath;
}

export function removeTempRepo(repoDir: string): void {
  fs.rmSync(repoDir, { recursive: true, force: true });
}
