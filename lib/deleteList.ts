import { supabase } from '@/lib/supabase';

/** Verify a row was deleted: RLS can otherwise return success with zero rows. */
export async function deleteOwnedList(id: string): Promise<void> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) throw new Error('Please sign in again before deleting your list.');
  const result = await supabase.from('lists').delete().eq('id', id).eq('user_id', data.user.id).select('id');
  if (result.error) throw new Error('Could not delete your list. Please try again.');
  if (!result.data?.some(row => row.id === id)) throw new Error('This list could not be deleted. Refresh and check that you own it.');
}
