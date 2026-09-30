import { decryptContent, encryptContent, MAX_CONTENT_BYTES, type Envelope, type Keyring } from '../_shared/content-crypto.ts';
export type ContentRow = Envelope & { owner_id: string; id: string; content_type: string; revision: number; created_at: string; updated_at: string };
export type Metadata = Pick<ContentRow, 'id'|'content_type'|'revision'|'created_at'|'updated_at'>;
export interface ContentStore {
  quota(owner: string): Promise<boolean>;
  get(owner: string, id: string): Promise<ContentRow | null>;
  write(owner: string, id: string, type: string, envelope: Envelope, revision: number): Promise<ContentRow | null>;
  remove(owner: string, id: string, revision: number): Promise<boolean>;
  list(owner: string, after: string | null): Promise<Metadata[]>;
}
export interface Dependencies {
  authenticate(token: string): Promise<string | null>;
  store: ContentStore;
  keyring(): Promise<Keyring>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const types = new Set(['profile','list','list_item','post','comment','report','feedback','preferences','other']);
const headers = {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'X-Content-Type-Options': 'nosniff',
};
function respond(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers }); }
async function boundedJson(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('No body');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.length;
      if (size > 96 * 1024) { await reader.cancel(); throw new Error('Too large'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  const parsed = JSON.parse(new TextDecoder().decode(data));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body');
  return parsed;
}
function metadata(row: ContentRow): Metadata {
  return { id: row.id, content_type: row.content_type, revision: row.revision, created_at: row.created_at, updated_at: row.updated_at };
}
export function createHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return respond(405, { error: 'Use POST.' });
    try {
      const match = /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') ?? '');
      if (!match) return respond(401, { error: 'Sign in to continue.' });
      const owner = await deps.authenticate(match[1]);
      if (!owner || !uuid.test(owner)) return respond(401, { error: 'Sign in to continue.' });
      if (!await deps.store.quota(owner)) return respond(429, { error: 'Too many requests. Try again next minute.' });
      let body: Record<string, unknown>;
      try { body = await boundedJson(request); } catch { return respond(400, { error: 'Invalid or oversized JSON request.' }); }
      if (body.action === 'list') {
        const after = body.after ?? null;
        if (after !== null && (typeof after !== 'string' || !uuid.test(after))) return respond(400, { error: 'Invalid cursor.' });
        const items = await deps.store.list(owner, after as string | null);
        return respond(200, { items, nextCursor: items.length === 50 ? items[49].id : null });
      }
      if (typeof body.id !== 'string' || !uuid.test(body.id)) return respond(400, { error: 'Invalid record ID.' });
      if (body.action === 'get') {
        const row = await deps.store.get(owner, body.id);
        if (!row) return respond(404, { error: 'Record not found.' });
        const payload = await decryptContent(row, { ownerId: owner, id: row.id, contentType: row.content_type }, await deps.keyring());
        return respond(200, { ...metadata(row), payload });
      }
      if (body.action !== 'put' && body.action !== 'delete') return respond(400, { error: 'Invalid action.' });
      const revision = body.expectedRevision;
      if (!Number.isSafeInteger(revision) || (revision as number) < (body.action === 'put' ? 0 : 1) || (revision as number) >= 2147483647) return respond(400, { error: 'Invalid expected revision.' });
      if (body.action === 'delete') {
        return await deps.store.remove(owner, body.id, revision as number)
          ? respond(200, { deleted: true }) : respond(409, { error: 'Record changed or does not exist. Refresh before retrying.' });
      }
      if (typeof body.contentType !== 'string' || !types.has(body.contentType) || !Object.hasOwn(body, 'payload')) return respond(400, { error: 'Invalid content type or payload.' });
      if (new TextEncoder().encode(JSON.stringify(body.payload)).length > MAX_CONTENT_BYTES) return respond(413, { error: 'Content exceeds 64 KiB.' });
      const envelope = await encryptContent(body.payload, { ownerId: owner, id: body.id, contentType: body.contentType }, await deps.keyring());
      const row = await deps.store.write(owner, body.id, body.contentType, envelope, revision as number);
      return row ? respond(200, metadata(row)) : respond(409, { error: 'Record changed or type differs. Refresh before retrying.' });
    } catch {
      // Do not log plaintext, authorization headers, encryption material or DB errors.
      return respond(500, { error: 'Content service unavailable. Please try again.' });
    }
  };
}
