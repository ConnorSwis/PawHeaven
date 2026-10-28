// Downloads the demo animals' photos once (cached in .cache/dekalb-images) and uploads them to the
// LOCAL Supabase pet-images bucket. Run after `npm run db:reset`, which clears Storage's records.
// Local only: it refuses any Supabase URL that is not on this machine.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const vars = Object.fromEntries(readFileSync(join(root, 'apps/api/.dev.vars'), 'utf8').split('\n').flatMap((line) => {
  const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  return match ? [[match[1], match[2]]] : [];
}));
const base = vars.SUPABASE_URL;
const key = vars.ADMIN_SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('db:images only runs against the local Supabase stack. Run npm run db:configure-api first.');

const manifest = JSON.parse(readFileSync(join(root, 'supabase/dekalb-images.json'), 'utf8'));
const cache = join(root, '.cache/dekalb-images');
const types = { 'image/jpeg': true, 'image/png': true, 'image/webp': true };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let downloaded = 0; let uploaded = 0; let failed = 0;

for (const { path, url } of manifest) {
  const file = join(cache, path);
  let type = 'image/jpeg';
  if (!existsSync(file)) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      const received = response.headers.get('content-type')?.split(';')[0] ?? '';
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!response.ok || !types[received] || bytes.length === 0 || bytes.length > 5 * 1024 * 1024) throw new Error(`${response.status} ${received}`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, bytes);
      downloaded += 1;
      await pause(250); // be gentle with the source's image server
    } catch (error) {
      console.warn(`skip ${path}: ${error.message}`);
      failed += 1;
      continue;
    }
  }
  const response = await fetch(`${base}/storage/v1/object/pet-images/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': type, 'x-upsert': 'true' },
    body: readFileSync(file),
  });
  if (response.ok) uploaded += 1; else { console.warn(`upload failed ${path}: ${response.status} ${(await response.text()).slice(0, 120)}`); failed += 1; }
}
console.log(`Photos: ${downloaded} downloaded, ${uploaded} uploaded, ${failed} skipped.`);
