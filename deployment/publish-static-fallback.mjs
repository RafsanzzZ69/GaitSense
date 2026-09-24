// Fallback for a missing bundled Sites helper. Credentials are stdin-only.
// Use only on the isolated, allowlisted showcase tree; never on the main repo.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'showcase');
const manifest = JSON.parse(readFileSync(path.join(directory, '.openai/hosting.json'), 'utf8'));
if (manifest.static?.directory !== 'dist') throw Error('Expected static showcase');
for (const entry of readdirSync(directory)) {
  if (!['.git', '.gitignore', '.openai', 'dist', 'source'].includes(entry)) throw Error(`Unexpected publish entry: ${entry}`);
}
function audit(folder) {
  for (const name of readdirSync(folder)) {
    const file = path.join(folder, name), info = lstatSync(file);
    if (info.isSymbolicLink()) throw Error('Symlinks not allowed');
    if (info.isDirectory()) audit(file);
    else if (/^\.env(?:\.|$)|\.(mov|mp4|webm|video|task|pkl|pickle)$/i.test(name)) throw Error('Private artifact found');
    else if (/\.(js|ts|tsx|json|html|md)$/i.test(name) && /mongodb(?:\+srv)?:\/\/|JWT_SECRET\s*=/.test(readFileSync(file, 'utf8'))) throw Error('Credential pattern found');
  }
}
audit(path.join(directory, 'dist')); audit(path.join(directory, 'source'));
if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log('Ready for credential JSON on stdin (hidden).');
// Do not use a terminal readline interface: terminal echo must be disabled by caller.
const lines = readline.createInterface({ input: process.stdin, terminal: false });
const input = await new Promise(resolve => lines.once('line', resolve)); lines.close();
const { credential, archivePath } = JSON.parse(input);
if (credential.repository !== manifest.project_id || credential.auth_mode !== 'http_extra_header') throw Error('Unexpected credential target/mode');
const remote = new URL(credential.remote_url);
if (remote.protocol !== 'https:' || remote.username || remote.password) throw Error('Invalid remote');
const archive = path.resolve(archivePath);
const expected = path.resolve(directory, '../../tmp/gaitsense-showcase.tar.gz');
if (archive !== expected) throw Error('Unexpected archive target');
const env = { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: `http.${remote.origin}/.extraheader`, GIT_CONFIG_VALUE_0: `Authorization: Bearer ${credential.token}`, GIT_TERMINAL_PROMPT: '0' };
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: directory, env, encoding: 'utf8', ...options });
  if (result.status !== 0) throw Error(`${command} failed: ${(result.stderr || result.error?.message || '').split(credential.token).join('[redacted]')}`);
  return result.stdout?.trim() || '';
}
if (!existsSync(path.join(directory, '.git'))) run('git', ['init', '-b', credential.branch]);
if (path.resolve(run('git', ['rev-parse', '--show-toplevel'])) !== directory) throw Error('Not an isolated repository');
const remotes = run('git', ['remote']).split('\n');
if (remotes.includes('origin')) {
  if (run('git', ['remote', 'get-url', 'origin']) !== credential.remote_url) throw Error('Existing remote mismatch');
} else run('git', ['remote', 'add', 'origin', credential.remote_url]);
run('git', ['add', '-A', '--', '.']);
if (run('git', ['status', '--porcelain'])) run('git', ['-c', 'user.name=GaitSense Build', '-c', 'user.email=gaitsense-build@users.noreply.github.com', 'commit', '-m', 'Publish synthetic GaitSense web showcase']);
const commit = run('git', ['rev-parse', 'HEAD']);
run('git', ['push', 'origin', `HEAD:refs/heads/${credential.branch}`]);
if (!run('git', ['ls-remote', 'origin', `refs/heads/${credential.branch}`]).startsWith(commit)) throw Error('Remote verification failed');
run('tar', ['-czf', archive, '.openai/hosting.json', 'dist']);
const entries = run('tar', ['-tzf', archive]).split(/\r?\n/);
if (!entries.includes('dist/index.html') || entries.some(e => e.includes('..') || (!e.startsWith('dist/') && e !== '.openai/hosting.json'))) throw Error('Unexpected archive contents');
console.log(JSON.stringify({ project_id: manifest.project_id, checkout_path: directory, commit_sha: commit, archive, files: entries.length }));
