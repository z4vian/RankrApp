import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGuestDraft, saveGuestDraft, getGuestDraft, clearGuestDraft, isGuestDraftPersistenceAvailable, validateGuestDraft, GUEST_DRAFT_TTL_MS } from '../../lib/guestDraft.ts';
const values = new Map<string,string>();
const key = 'rankr.guest-draft.v1';
Object.defineProperty(globalThis, 'window', { value: { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key,value); }, removeItem: (key: string) => { values.delete(key); } } }, configurable: true });
test('durable bounded guest drafts, expiration and detached copies', () => {
  const draft = createGuestDraft('movies','  My picks  ');
  draft.items.push({ id: crypto.randomUUID(), title:'A', image_url:'/media/poster.webp' });
  assert.equal(isGuestDraftPersistenceAvailable(),true);
  saveGuestDraft(draft);
  assert.equal(getGuestDraft()?.title,'My picks');
  const copy = getGuestDraft()!; copy.items[0].title='mutated';
  assert.equal(getGuestDraft()?.items[0].title,'A');
  values.set(key,JSON.stringify({ ...draft, updatedAt:Date.now()-GUEST_DRAFT_TTL_MS-1 }));
  assert.equal(getGuestDraft(),null); assert.equal(values.has(key),false);
  assert.throws(() => validateGuestDraft({ ...draft, items:Array.from({length:21},() => ({id:crypto.randomUUID(),title:'A'})) }));
  assert.throws(() => validateGuestDraft({ ...draft, items:[draft.items[0],draft.items[0]] }));
  for (const image_url of ['javascript:alert(1)','file:///secret','//evil.test/x','/media/../secret','/media/%2e%2e/secret','https://user:pass@host.test/a']) assert.throws(() => validateGuestDraft({...draft,items:[{...draft.items[0],image_url}]}));
  clearGuestDraft(); assert.equal(getGuestDraft(),null);
});
test('unavailable browser storage keeps memory draft and reports nonpersistence', () => {
  Object.defineProperty(globalThis, 'window', { value: { get localStorage() { throw new Error('blocked'); } }, configurable:true });
  const draft = createGuestDraft('books','My books'); saveGuestDraft(draft);
  assert.equal(isGuestDraftPersistenceAvailable(),false);
  assert.equal(getGuestDraft()?.id,draft.id);
  clearGuestDraft(); assert.equal(getGuestDraft(),null);
});
