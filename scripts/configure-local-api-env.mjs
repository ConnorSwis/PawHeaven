import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
let output;

try {
  output = execFileSync(command, ['supabase', 'status', '--output', 'env'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch {
  console.error('Could not read the local Supabase stack. Start Docker, then run npm run db:start.');
  process.exit(1);
}

const values = Object.fromEntries(output.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) return [];
  const [, name, rawValue] = match;
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    try { return [[name, JSON.parse(rawValue)]]; } catch { return []; }
  }
  return [[name, rawValue]];
}));
const url = values.API_URL;
const key = values.PUBLISHABLE_KEY ?? values.ANON_KEY;

if (!url || !key) {
  console.error('The local Supabase stack did not return an API URL and publishable key. Run npm run db:start, then try again.');
  process.exit(1);
}

try {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) throw new Error('not local');
} catch {
  console.error('Refusing to write API settings for a non-local Supabase URL.');
  process.exit(1);
}

const destination = resolve(repositoryRoot, 'apps/api/.dev.vars');
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, [
  '# Generated from this machine\'s local Supabase stack. Do not commit or share this file.',
  `SUPABASE_URL=${JSON.stringify(url)}`,
  `SUPABASE_KEY=${JSON.stringify(key)}`,
  'ALLOWED_ORIGINS="http://localhost:4321"',
  '',
].join('\n'));

console.log('Configured apps/api/.dev.vars for local Supabase.');
