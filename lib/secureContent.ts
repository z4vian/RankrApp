import { supabase } from '@/lib/supabase';
export type SecureContentType = 'profile' | 'list' | 'list_item' | 'post' | 'comment' | 'report' | 'feedback' | 'preferences' | 'other';
export type SecureContentMetadata = { id: string; content_type: SecureContentType; revision: number; created_at: string; updated_at: string };
async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('secure-content', { body });
  if (error || data?.error) throw new Error(data?.error ?? 'Secure content unavailable. Refresh and retry.');
  return data as T;
}
/** Opt-in encrypted store. Existing application tables are not automatically migrated. */
export const secureContent = {
  get: <T>(id: string) => call<SecureContentMetadata & { payload: T }>({ action: 'get', id }),
  put: (id: string, contentType: SecureContentType, payload: unknown, expectedRevision: number) => call<SecureContentMetadata>({ action: 'put', id, contentType, payload, expectedRevision }),
  remove: (id: string, expectedRevision: number) => call<{ deleted: true }>({ action: 'delete', id, expectedRevision }),
  list: (after: string | null = null) => call<{ items: SecureContentMetadata[]; nextCursor: string | null }>({ action: 'list', after }),
};
