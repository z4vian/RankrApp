import { createClient } from 'npm:@supabase/supabase-js@2.99.2';
import { createDeletionHandler } from './handler.ts';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
Deno.serve(createDeletionHandler({
  async authenticate(token) { const { data, error } = await admin.auth.getUser(token); return error ? null : data.user?.id ?? null; },
  async list(bucket, prefix, offset, search) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 100, offset, search, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error; return data ?? [];
  },
  async remove(bucket, paths) { const { error } = await admin.storage.from(bucket).remove(paths); if (error) throw error; },
  async deleteUser(id) { const { error } = await admin.auth.admin.deleteUser(id); if (error) throw error; },
}));
