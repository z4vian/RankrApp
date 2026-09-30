import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadKeyring, encryptContent, decryptContent } from '../../supabase/functions/_shared/content-crypto.ts';
import { createHandler, type ContentRow } from '../../supabase/functions/secure-content/handler.ts';
import { photoObjectPath } from '../../lib/photoReferences.ts';
const owner = '11111111-1111-4111-8111-111111111111', id = '22222222-2222-4222-8222-222222222222';
const context = { ownerId: owner, id, contentType: 'post' };
const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
const ring = await loadKeyring(JSON.stringify({ v1: key }), 'v1');
test('AES GCM roundtrip, random nonce, tamper and context binding', async () => {
  const envelope = await encryptContent({ body: 'private ☃' }, context, ring);
  assert.deepEqual(await decryptContent(envelope, context, ring), { body: 'private ☃' });
  assert.notEqual(envelope.iv, (await encryptContent({ body: 'private ☃' }, context, ring)).iv);
  for (const changed of [{ ...context, id: owner }, { ...context, ownerId: id }, { ...context, contentType: 'list' }]) await assert.rejects(decryptContent(envelope, changed, ring));
  await assert.rejects(decryptContent({ ...envelope, ciphertext: 'AAAA' + envelope.ciphertext.slice(4) }, context, ring));
  const next = await loadKeyring(JSON.stringify({ v1: key, v2: btoa('x'.repeat(32)) }), 'v2');
  assert.deepEqual(await decryptContent(envelope, context, next), { body: 'private ☃' });
  assert.equal((await encryptContent({}, context, next)).key_id, 'v2');
  await assert.rejects(loadKeyring(JSON.stringify({ v1: 'bad' }), 'v1'));
});
test('handler auth, owner binding, CAS, payload bound, no-store and quota', async () => {
  let row: ContentRow | null = null; let allowed = true;
  const handler = createHandler({ authenticate: async token => token === 'valid' ? owner : null, keyring: async () => ring, store: {
    quota: async () => allowed,
    get: async (who, requested) => who === owner && requested === row?.id ? row : null,
    write: async (who, requested, type, envelope, revision) => {
      assert.equal(who, owner);
      if (revision !== (row?.revision ?? 0)) return null;
      return row = { ...envelope, owner_id: who, id: requested, content_type: type, revision: revision + 1, created_at: '', updated_at: '' };
    }, remove: async () => false, list: async () => [],
  } });
  const request = (body: unknown, token = 'valid') => handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }));
  assert.equal((await request({}, 'invalid')).status, 401);
  const put = { action: 'put', id, contentType: 'post', payload: { message: 'secret' }, expectedRevision: 0, owner_id: id };
  assert.equal((await request(put)).status, 200);
  assert.equal((await request(put)).status, 409);
  const get = await request({ action: 'get', id });
  assert.equal(get.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await get.json()).payload, put.payload);
  assert.equal((await request({ ...put, payload: 'x'.repeat(65536) })).status, 413);
  assert.equal((await request({ ...put, payload: 'x'.repeat(100000) })).status, 400);
  assert.equal((await request({ action: 'get', id: owner })).status, 404);
  allowed = false; assert.equal((await request({ action: 'list' })).status, 429);
});
test('photo references accept only exact project legacy URLs and safe paths', () => {
  const path = `${owner}/photo.jpg`, project = 'https://project.supabase.co';
  assert.equal(photoObjectPath(`storage://list-item-photos/${path}`, project), path);
  assert.equal(photoObjectPath(`${project}/storage/v1/object/public/list-item-photos/${path}`, project), path);
  for (const value of [`https://evil.test/storage/v1/object/public/list-item-photos/${path}`, `storage://list-item-photos/${owner}/../photo.jpg`, `${project}/storage/v1/object/public/list-item-photos/${path}?token=secret`]) assert.equal(photoObjectPath(value, project), null);
});

test('deletion verifies auth, retries partial storage failures, and strictly scopes legacy avatars', async () => {
  const { createDeletionHandler } = await import('../../supabase/functions/delete-account/handler.ts');
  let fail = true, deleted = 0, lists = 0;
  const photos = ['photo.jpg'];
  const avatar = `avatar-${owner}-123.jpg`;
  const removals: string[] = [];
  const handler = createDeletionHandler({
    authenticate: async token => token === 'valid' ? owner : null,
    list: async (bucket, prefix) => {
      lists++;
      if (bucket === 'list-item-photos') { assert.equal(prefix, owner); return photos.map(name => ({ id: 'obj', name })); }
      return [avatar, `avatar-${id}-123.jpg`, `${avatar}.evil`, `x${avatar}`].filter(name => !removals.includes(name)).map(name => ({ id: 'obj', name }));
    },
    remove: async (bucket, paths) => {
      if (fail) throw new Error('Storage unavailable');
      if (bucket === 'list-item-photos') photos.length = 0;
      else removals.push(...paths);
    },
    deleteUser: async who => { assert.equal(who, owner); deleted++; },
  });
  const request = (token: string) => handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }));
  assert.equal((await request('invalid')).status, 401); assert.equal(lists, 0);
  assert.equal((await request('valid')).status, 500); assert.equal(deleted, 0);
  fail = false;
  assert.equal((await request('valid')).status, 200); assert.equal(deleted, 1);
  assert.deepEqual(removals, [avatar]);
});
test('deletion auth failure after storage cleanup is retryable', async () => {
  const { createDeletionHandler } = await import('../../supabase/functions/delete-account/handler.ts');
  let tries = 0;
  const handler = createDeletionHandler({ authenticate: async () => owner, list: async () => [], remove: async () => {}, deleteUser: async () => { if (++tries === 1) throw new Error('Auth unavailable'); } });
  const request = () => handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer valid' } }));
  assert.equal((await request()).status, 500);
  assert.equal((await request()).status, 200);
});
test('push fails closed for missing secret, missing credential and ordinary user JWT', async () => {
  const { authorizePush } = await import('../../supabase/functions/send-push-notification/auth.ts');
  const secret = 's'.repeat(64);
  assert.equal(await authorizePush(undefined, ''), 503);
  assert.equal(await authorizePush('short', 'short'), 503);
  assert.equal(await authorizePush(secret, ''), 401);
  assert.equal(await authorizePush(secret, 'Bearer ordinary-user-jwt'), 401);
  assert.equal(await authorizePush(secret, secret), 200);
});
