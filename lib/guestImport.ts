import { supabase } from '@/lib/supabase';
import { validateGuestDraft, type GuestDraft } from './guestDraft';
/** One authenticated transaction; retry preserves the first successful import. */
export async function importGuestDraft(draft: GuestDraft): Promise<{ id: string; title: string; category: string }> {
  const valid = validateGuestDraft(draft);
  if (!valid.items.length) throw new Error('Add at least one item before saving your list.');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Sign in before saving your guest list.');
  const { data, error } = await supabase.rpc('rankr_import_guest_list', { p_draft: valid });
  if (error) throw new Error('Could not save your list. Your guest draft is still on this device; please retry.');
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.id !== valid.id || typeof result.title !== 'string' || typeof result.category !== 'string') throw new Error('Could not confirm your saved list. Please retry.');
  // Caller clears the local draft only after confirmed success and navigation.
  return { id: result.id, title: result.title, category: result.category };
}
