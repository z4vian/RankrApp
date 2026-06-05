/**
 * Edge Function: send-push-notification
 *
 * Sends a push notification to every device registered for a given set of
 * user IDs. Reads tokens from `public.push_tokens` (created in
 * `docs/PHASE-5-MIGRATION.sql`) using the service-role key, then batches
 * them to Expo's push HTTP API.
 *
 * Deploy this file into Supabase Edge Functions as `send-push-notification`.
 * See `docs/edge-functions/README.md` for the deployment walkthrough.
 *
 * ----------------------------------------------------------------------------
 * Runtime: Deno (Supabase Edge Functions)
 *
 * Required environment variables (set as Edge Function secrets):
 *   - SUPABASE_URL                  (auto-injected)
 *   - SUPABASE_SERVICE_ROLE_KEY     (set manually — server-only)
 *   - EXPO_ACCESS_TOKEN             (optional — only needed if your Expo
 *                                    project requires authenticated push;
 *                                    most setups can omit this)
 *
 * Request body:
 *   {
 *     "user_ids": string[],            // recipients (Supabase user.id values)
 *     "title": string,                 // notification title
 *     "body": string,                  // notification body text
 *     "data"?: Record<string, unknown> // optional payload for deep-linking
 *   }
 *
 * Auth model:
 *   This function does NOT validate the caller's identity — it's intended
 *   to be invoked from trusted server-side contexts (database triggers via
 *   pg_net, other edge functions, or admin scripts). If you want to expose
 *   it directly to the mobile app, wrap it in another function that
 *   validates the caller and rate-limits.
 *
 * Expo push API:
 *   POST https://exp.host/--/api/v2/push/send
 *   Body: [{ to: ExponentPushToken, title, body, data }, ...]
 *   Returns a per-message ticket. We log failures but don't fail the
 *   overall request — partial delivery is fine.
 * ----------------------------------------------------------------------------
 */

// @ts-nocheck — this file runs under Deno; types are resolved at deploy time.
//
// See the matching note in delete-account.ts for why we use Deno-style
// imports here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PushBody = {
  user_ids?: string[];
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

type ExpoMessage = {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
};

/**
 * Expo's push API caps each request at 100 messages. We chunk to 100 even
 * though we typically send far fewer.
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[send-push] missing env vars");
      return new Response(
        JSON.stringify({ error: "Server misconfigured." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let body: PushBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userIds = Array.isArray(body.user_ids)
      ? body.user_ids.filter((u) => typeof u === "string" && u.length > 0)
      : [];
    const title = typeof body.title === "string" ? body.title : "";
    const text = typeof body.body === "string" ? body.body : "";
    const data = body.data && typeof body.data === "object" ? body.data : undefined;

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "user_ids must be a non-empty array of strings." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!title && !text) {
      return new Response(
        JSON.stringify({ error: "At least one of title or body is required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Service-role client to read all tokens for the recipient set.
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: tokenRows, error: tokenErr } = await admin
      .from("push_tokens")
      .select("token")
      .in("user_id", userIds);

    if (tokenErr) {
      console.error("[send-push] token lookup", tokenErr.message);
      return new Response(
        JSON.stringify({ error: "Failed to look up push tokens." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const tokens: string[] = (tokenRows ?? [])
      .map((r: { token?: unknown }) => r.token)
      .filter((t: unknown): t is string => typeof t === "string" && t.length > 0);

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, note: "No push tokens registered for those users." }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build the Expo push messages.
    const messages: ExpoMessage[] = tokens.map((to) => ({
      to,
      title: title || undefined,
      body: text || undefined,
      data,
      sound: "default",
    }));

    // Send in chunks of 100.
    const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
    const expoHeaders: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip, deflate",
    };
    if (expoAccessToken) {
      expoHeaders["Authorization"] = `Bearer ${expoAccessToken}`;
    }

    let totalSent = 0;
    const errors: string[] = [];
    for (const batch of chunk(messages, 100)) {
      try {
        const res = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: expoHeaders,
          body: JSON.stringify(batch),
        });
        if (!res.ok) {
          const txt = await res.text();
          console.error("[send-push] expo HTTP", res.status, txt);
          errors.push(`HTTP ${res.status}`);
          continue;
        }
        // Expo returns `{ data: PushTicket[] }`. We treat any ticket with
        // status !== 'ok' as a per-message failure but don't fail the batch.
        const json = await res.json();
        const tickets = Array.isArray(json?.data) ? json.data : [];
        for (const t of tickets) {
          if (t?.status === "ok") {
            totalSent += 1;
          } else if (t?.message) {
            errors.push(String(t.message));
          }
        }
      } catch (err) {
        console.error("[send-push] batch failed", err);
        errors.push(String(err));
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent: totalSent, failed: errors.length, errors: errors.slice(0, 20) }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[send-push] unexpected", err);
    return new Response(
      JSON.stringify({ error: "Unexpected error." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
