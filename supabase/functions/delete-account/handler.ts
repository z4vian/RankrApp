export type StoredObject = { id: string | null; name: string };
export interface DeletionDependencies {
  authenticate(token: string): Promise<string | null>;
  list(bucket: string, prefix: string, offset: number, search?: string): Promise<StoredObject[]>;
  remove(bucket: string, paths: string[]): Promise<void>;
  deleteUser(id: string): Promise<void>;
}
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export function createDeletionHandler(deps: DeletionDependencies) {
  return async (request: Request) => {
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
    const token = /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
    if (!token) return reply(401, { error: 'Sign in to continue.' });
    try {
      const userId = await deps.authenticate(token);
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(userId)) return reply(401, { error: 'Sign in to continue.' });
      // Re-read first page after deletion to avoid offset skips. No raw SQL deletes.
      for (let page = 0; page < 100; page++) {
        const data = await deps.list('list-item-photos', userId, 0);
        if (!data.length) break;
        if (data.some(item => !item.id || item.name.includes('/'))) throw new Error('Unsupported storage layout');
        await deps.remove('list-item-photos', data.map(item => `${userId}/${item.name}`));
        if (page === 99) return reply(503, { error: 'Cleanup is incomplete. Retry to continue.' });
      }
      // Legacy avatars live at bucket root. Search only narrows candidates;
      // the anchored match is authoritative. Collect before removal so offset
      // pagination cannot skip entries as preceding objects disappear.
      const avatarPattern = new RegExp(`^avatar-${userId}-[0-9]+\\.jpg$`);
      const avatars: string[] = []; let complete = false;
      for (let page = 0; page < 100; page++) {
        const data = await deps.list('avatars', '', page * 100, `avatar-${userId}-`);
        for (const item of data) if (item.id && avatarPattern.test(item.name)) avatars.push(item.name);
        if (data.length < 100) { complete = true; break; }
      }
      for (let i = 0; i < avatars.length; i += 100) await deps.remove('avatars', avatars.slice(i, i + 100));
      if (!complete) return reply(503, { error: 'Cleanup is incomplete. Retry to continue.' });
      // Not atomic across Storage/Auth. Retain identity on failure for retry.
      await deps.deleteUser(userId);
      return reply(200, { ok: true });
    } catch { return reply(500, { error: 'Deletion incomplete. Please retry.' }); }
  };
}
