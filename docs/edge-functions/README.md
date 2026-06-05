# Rankr — Supabase Edge Functions

This directory holds Deno TypeScript sources for the two Edge Functions
Phase 5 introduces. **They are not part of the React Native bundle.** You
deploy them once via the Supabase CLI, set secrets, and they live server-
side from then on.

| Function                  | Source file                          | Used by                                  |
|---------------------------|--------------------------------------|------------------------------------------|
| `delete-account`          | `delete-account.ts`                  | `lib/account.ts` → `requestAccountDeletion` |
| `send-push-notification`  | `send-push-notification.ts`          | Server-side triggers / RPCs (see below)  |

---

## Prerequisites

- Supabase CLI installed. macOS:
  ```bash
  brew install supabase/tap/supabase
  ```
  Or via npm (per-project):
  ```bash
  npx supabase --version
  ```
- Logged in to your Supabase account:
  ```bash
  supabase login
  ```
- Project linked from the repo root (replaces `<project-ref>` with the
  hex string in your Supabase dashboard URL — e.g. `abcd1234`):
  ```bash
  supabase link --project-ref <project-ref>
  ```

---

## One-time setup

The Supabase CLI expects Edge Function sources under `supabase/functions/<name>/index.ts`.
The source files in this directory are *templates* — the actual deploy step copies
them into that location.

The simplest path is to set up the Supabase folder once, then re-copy the
files whenever you update them:

```bash
# From the repo root:
mkdir -p supabase/functions/delete-account
mkdir -p supabase/functions/send-push-notification

cp docs/edge-functions/delete-account.ts          supabase/functions/delete-account/index.ts
cp docs/edge-functions/send-push-notification.ts  supabase/functions/send-push-notification/index.ts
```

> The `supabase/` directory is what the Supabase CLI manages locally. Add
> it to `.gitignore` if you don't want to track generated config, or
> commit it if you want CI / teammates to redeploy from the repo.

---

## Set the required secrets

Both functions need the service-role key. The send-push function optionally
takes an Expo access token. Set them once:

```bash
# Service-role key — server-only, NEVER ship to the mobile bundle.
# Copy from: Supabase dashboard → Project Settings → API → "service_role" key.
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<paste-key-here>

# Optional: only needed if your Expo project requires authenticated push.
# Most setups don't; skip this if you don't have a reason for it.
supabase secrets set EXPO_ACCESS_TOKEN=<paste-token-here>
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are auto-injected — you don't need
to set them manually.

To verify:
```bash
supabase secrets list
```

---

## Deploy

After copying the files into `supabase/functions/...` (see "One-time setup"):

```bash
supabase functions deploy delete-account
supabase functions deploy send-push-notification
```

Each command prints a deploy URL like:
```
https://<project-ref>.functions.supabase.co/delete-account
```

---

## Smoke test (curl)

### delete-account

This actually deletes a user. **Only run against a throwaway test account.**

```bash
# Get a JWT for the test user first — easiest is to sign in via the app
# and copy `access_token` from the network panel.
JWT=eyJhbGciOi...

curl -X POST https://<project-ref>.functions.supabase.co/delete-account \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json"
# Expect:  {"ok":true,"user_id":"<uuid>"}
```

### send-push-notification

```bash
SERVICE_ROLE_KEY=eyJhbGciOi...  # from Project Settings → API

curl -X POST https://<project-ref>.functions.supabase.co/send-push-notification \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": ["<some-user-uuid>"],
    "title":    "Test",
    "body":     "It works!",
    "data":     { "screen": "home" }
  }'
# Expect:  {"ok":true,"sent":N,"failed":0,"errors":[]}
```

If `sent` is 0 and the response says "No push tokens registered for those
users," that's expected — the recipient must have called `registerPushToken`
from the mobile app at least once.

---

## How to trigger `send-push-notification` from the database

Two options. Pick one:

### Option A — Trigger via `pg_net` extension (recommended)

`pg_net` ships with Supabase. It lets you make HTTP calls from inside a
Postgres trigger function:

```sql
-- Enable once per project.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Example: notify the owner when their list_item gets a new like.
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  owner_id uuid;
  item_title text;
BEGIN
  SELECT l.user_id, li.title
    INTO owner_id, item_title
  FROM public.list_items li
  JOIN public.lists l ON l.id = li.list_id
  WHERE li.id = NEW.list_item_id;

  -- Don't notify self-likes.
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://<project-ref>.functions.supabase.co/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object(
      'user_ids', jsonb_build_array(owner_id::text),
      'title',    'New like',
      'body',     'Someone liked "' || COALESCE(item_title, 'your item') || '"',
      'data',     jsonb_build_object('list_item_id', NEW.list_item_id::text)
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS likes_notify ON public.likes;
CREATE TRIGGER likes_notify
  AFTER INSERT ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_like();
```

You need to set the service-role key as a session GUC (the
`current_setting('app.service_role_key', true)` call above). One simple
way is via a dashboard SQL run:
```sql
ALTER DATABASE postgres SET app.service_role_key = '<paste-key>';
```
After that, every connection sees the value. **Note:** this is a server-
side secret and never leaves Postgres; the mobile app never sees it.

### Option B — RPC from the mobile app

If you'd rather invoke the function from the app (e.g. immediately after
a `like` insert), call:

```ts
await supabase.functions.invoke('send-push-notification', {
  body: {
    user_ids: [ownerId],
    title:    'New like',
    body:     `Someone liked "${itemTitle}"`,
    data:     { list_item_id: itemId },
  },
});
```

This requires the function to be open to client invocation (which it is in
the source as written). For production you should add a caller-identity
check in `send-push-notification.ts` — otherwise any client could spam
notifications to any user.

---

## Updating a deployed function

1. Edit the file in `docs/edge-functions/`.
2. Re-copy into `supabase/functions/<name>/index.ts`.
3. `supabase functions deploy <name>` again.

The deploy step is idempotent — repeated deploys just replace the running
version.
