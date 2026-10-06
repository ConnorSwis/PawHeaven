import { createClient } from '@supabase/supabase-js';

const userId = process.argv[2];
const role = process.argv[3];
const url = process.env.SUPABASE_URL || 'https://zzcbjfgyibhuhlylsvhs.supabase.co';
const key = process.env.SUPABASE_SECRET_KEY;

if (!/^[0-9a-f-]{36}$/i.test(userId || '') || !['user', 'staff', 'admin'].includes(role) || !key) {
  console.error('Set SUPABASE_SECRET_KEY in the environment, then run: npm run staff:role -w @pawheaven/api -- <user UUID> <user|staff|admin>');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await admin.auth.admin.getUserById(userId);
if (error || !data.user) throw new Error(error?.message || 'User not found.');
const updated = await admin.auth.admin.updateUserById(userId, {
  app_metadata: { ...data.user.app_metadata, role },
});
if (updated.error) throw updated.error;
console.log(`Updated ${userId} to ${role}. Ask the user to sign in again to refresh role claims.`);
