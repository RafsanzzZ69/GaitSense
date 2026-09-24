import { spawnSync } from 'node:child_process';
import { cpSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.resolve(root, '../deployment/showcase');
if (!existsSync(path.join(destination, '.openai/hosting.json'))) throw Error('Register or configure the showcase deployment first.');
const build = spawnSync(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'export', '--platform', 'web', '--clear', '--output-dir', 'dist-showcase'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_SHOWCASE: 'true', EXPO_PUBLIC_API_URL: '', EXPO_NO_DOTENV: '1' },
});
if (build.status !== 0) process.exit(build.status ?? 1);
const output = path.join(root, 'dist-showcase');
function check(directory) {
  for (const name of readdirSync(directory)) {
    const file = path.join(directory, name);
    if (statSync(file).isDirectory()) check(file);
    else {
      if (/\.(env|mov|mp4|video|task|pkl|pickle)$/i.test(name)) throw Error('Unexpected sensitive artifact in public output');
      if (/\.(js|html|json)$/i.test(name) && /mongodb(?:\+srv)?:\/\/|JWT_SECRET\s*=/.test(readFileSync(file, 'utf8'))) throw Error('Database credential pattern found in public output');
    }
  }
}
check(output);
const publicDirectory = path.join(destination, 'dist');
if (path.relative(root, publicDirectory) !== path.join('..', 'deployment', 'showcase', 'dist')) throw Error('Unexpected generated-output directory');
if (existsSync(publicDirectory) && lstatSync(publicDirectory).isSymbolicLink()) throw Error('Refusing linked output directory');
rmSync(publicDirectory, { recursive: true, force: true });
mkdirSync(publicDirectory, { recursive: true });
cpSync(output, publicDirectory, { recursive: true });
// Direct links/reloads work even on static servers without an SPA fallback.
for (const route of ['dashboard', 'assess', 'history', 'profile', 'login', 'register', 'report/sample-report', 'report/sample-previous']) {
  const folder = path.join(publicDirectory, route);
  mkdirSync(folder, { recursive: true });
  copyFileSync(path.join(output, 'index.html'), path.join(folder, 'index.html'));
}
// Only selected frontend sources: no backend, private environment, research or recordings.
const source = path.join(destination, 'source/frontend');
mkdirSync(source, { recursive: true });
for (const name of ['src','assets','tests','README.md','app.json','package.json','package-lock.json','tsconfig.json','AGENTS.md']) {
  cpSync(path.join(root, name), path.join(source, name), { recursive: true });
}
console.log('Public showcase build prepared; no private recordings or backend configuration copied.');
