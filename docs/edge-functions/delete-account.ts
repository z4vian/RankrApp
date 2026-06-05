/**
 * Edge Function: delete-account
 *
 * Deletes the calling user's `auth.users` row via the service-role admin
 * API. The client-side helper (`lib/account.ts` → `requestAccountDeletion`)
 * has already best-effort cleaned up the user's owned rows; CASCADE FKs on
 * `auth.users` will sweep up anything that survived.
 *
 * Deploy this file into Supabase Edge Functions as `delete-account`.
 * See `docs/edge-functions/README.md` for the deployment walkthrough.
 *
 * ----------------------------------------------------------------------------
 * Runtime: Deno (Supabase Edge Functions)
 * Entry:   The default exported handler (`Deno.serve`) responds to POST.
 *
 * Required environment variables (set as Edge Function secrets):
 *   - SUPABASE_URL                  (auto-injected by Supabase)
 *   - SUPABASE_SERVICE_ROLE_KEY     (you must set this manually — never ship
 *                                    this key in the mobile-app bundle!)
 *
 * Auth:
 *   - The incoming request must include `Authorization: Bearer <jwt>` from
 *     the caller's Supabase session. We use that JWT to identify which
 *     user is requesting deletion — never trust a `user_id` from the body.
 *   - The handler creates a Supabase client scoped to that JWT, calls
 *     `getUser()` to resolve the caller, then switches to a service-role
 *     client to invoke `auth.admin.deleteUser`.
 * ----------------------------------------------------------------------------
 */

// @ts-nocheck — this file runs under Deno; types are resolved at deploy time.
//
// NOTE: This source file lives under `docs/` so it isn't compiled by the
// app's tsconfig (which targets RN / Metro). At deploy time, Supabase's
// Edge Functions runtime resolves the Deno imports below from
// https://esm.sh / https://deno.land.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers so the function can be invoked from the mobile app, the
// expo dev tools, or a curl smoke test from any origin.
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request): Promise<Response> => {
  // Preflight.
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
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[delete-account] missing env vars");
      return new Response(
        JSON.stringify({ error: "Server misconfigured." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Step 1: resolve the caller via their JWT. Use the anon key plus the
    // incoming Authorization header so getUser() returns the JWT's subject.
    const anonClient = createClient(
      supabaseUrl,
      // The anon key is also auto-injected as SUPABASE_ANON_KEY by Supabase.
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userResult, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !userResult?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userId = userResult.user.id;

    // Step 2: service-role client to call the admin delete API. This key
    // bypasses RLS and has the auth.admin namespace available.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteErr) {
      console.error("[delete-account] admin.deleteUser", deleteErr.message);
      return new Response(
        JSON.stringify({ error: "Failed to delete account." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, user_id: userId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[delete-account] unexpected", err);
    return new Response(
      JSON.stringify({ error: "Unexpected error." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
