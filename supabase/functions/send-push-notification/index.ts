import { authorizePush } from './auth.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.99.2';
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
Deno.serve(async (request: Request) => {
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
  // Dedicated server credential. Client JWTs / anon keys never authorize dispatch.
  const authorized = await authorizePush(Deno.env.get('RANKR_PUSH_SERVER_SECRET'), request.headers.get('x-rankr-push-secret') ?? '');
  if (authorized !== 200) return reply(authorized, { error: authorized === 503 ? 'Push dispatch unavailable.' : 'Unauthorized.' });
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply(400, { error: 'Missing body.' });
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.length;
        if (size > 8192) { await reader.cancel(); return reply(413, { error: 'Payload too large.' }); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    const ids = body?.user_ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) || typeof body.title !== 'string' || typeof body.body !== 'string' || body.title.length > 120 || body.body.length > 1000 || (!body.title && !body.body) || (body.data !== undefined && (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)))) return reply(400, { error: 'Invalid push payload.' });
    if (JSON.stringify(body.data ?? {}).length > 2048) return reply(413, { error: 'Data too large.' });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data, error } = await admin.from('push_tokens').select('token').in('user_id', [...new Set(ids)]).limit(1001);
    if (error) throw error;
    if ((data?.length ?? 0) > 1000) return reply(413, { error: 'Recipient device limit exceeded.' });
    const tokens = [...new Set((data ?? []).map(row => row.token as string))];
    let accepted = 0; let failed = 0;
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100);
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json', ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}) },
        body: JSON.stringify(batch.map(to => ({ to, title: body.title, body: body.body, data: body.data, sound: 'default' }))),
      });
      if (!response.ok) { failed += batch.length; continue; }
      const result = await response.json();
      const tickets = Array.isArray(result?.data) ? result.data : [];
      const dead: string[] = [];
      for (let j = 0; j < batch.length; j++) {
        if (tickets[j]?.status === 'ok') accepted++; else failed++;
        if (tickets[j]?.details?.error === 'DeviceNotRegistered') dead.push(batch[j]);
      }
      if (dead.length) await admin.from('push_tokens').delete().in('token', dead);
    }
    return reply(200, { ok: failed === 0, accepted, failed });
  } catch { return reply(500, { error: 'Push dispatch failed; partial acceptance is possible.' }); }
});
