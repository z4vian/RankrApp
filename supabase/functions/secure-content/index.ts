import { createClient } from 'npm:@supabase/supabase-js@2.99.2';
import { loadKeyring } from '../_shared/content-crypto.ts';
import { createHandler, type ContentStore } from './handler.ts';
const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const auth = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const store: ContentStore = {
  async quota(owner) {
    const { data, error } = await admin.rpc('rankr_content_take_quota', { p_owner: owner });
    if (error) throw error;
    return data === true;
  },
  async get(owner, id) {
    const { data, error } = await admin.from('encrypted_content').select('*').eq('owner_id', owner).eq('id', id).maybeSingle();
    if (error) throw error; return data;
  },
  async write(owner, id, type, envelope, revision) {
    const { data, error } = await admin.rpc('rankr_content_write', { p_owner: owner, p_id: id, p_type: type, p_ciphertext: envelope.ciphertext, p_iv: envelope.iv, p_key_id: envelope.key_id, p_expected_revision: revision });
    if (error) throw error; return data?.[0] ?? null;
  },
  async remove(owner, id, revision) {
    const { data, error } = await admin.from('encrypted_content').delete().eq('owner_id', owner).eq('id', id).eq('revision', revision).select('id');
    if (error) throw error; return data?.length === 1;
  },
  async list(owner, after) {
    let query = admin.from('encrypted_content').select('id,content_type,revision,created_at,updated_at').eq('owner_id', owner).order('id').limit(50);
    if (after) query = query.gt('id', after);
    const { data, error } = await query;
    if (error) throw error; return data ?? [];
  },
};
Deno.serve(createHandler({
  store,
  async authenticate(token) { const { data, error } = await auth.auth.getUser(token); return error ? null : data.user?.id ?? null; },
  keyring: () => loadKeyring(Deno.env.get('RANKR_CONTENT_KEYS') ?? '', Deno.env.get('RANKR_ACTIVE_CONTENT_KEY') ?? ''),
}));
