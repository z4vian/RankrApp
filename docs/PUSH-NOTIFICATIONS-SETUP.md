# Rankr — Push Notifications Setup

End-to-end walkthrough for wiring up Expo push notifications. Covers:
package install, native config in `app.json`, Apple/Google credential
setup, client-side registration (the `lib/pushTokens.ts` calls), Edge
Function deploy, and the database trigger that fires notifications on
new `likes` / `comments`.

> **Read first:** `docs/PHASE-5-MIGRATION.sql` (creates the `push_tokens`
> table) and `docs/edge-functions/README.md` (deploys the Edge Functions).
> This doc is the "now wire it together" layer on top of those two.

---

## 0. Install `expo-notifications`

> **FRONTEND-DEV ACTION REQUIRED:** This dependency is **not yet in
> `package.json`**. Backend-dev (the agent owning `lib/`) cannot add npm
> dependencies — you (frontend-dev) need to run:
>
> ```bash
> npx expo install expo-notifications
> ```
>
> `expo install` (instead of plain `npm install`) is important — it picks
> the version compatible with your Expo SDK. Commit the resulting
> `package.json` / `package-lock.json` changes.

After install, the package adds a tiny config plugin you may want to put
in `app.json` (see step 2).

---

## 1. Apple Push Notification service (APNs)

iOS push goes through APNs. EAS Build can manage the APNs key for you
end-to-end:

```bash
eas credentials --platform ios
```

In the interactive menu pick:
1. The build profile to configure (e.g. `production`).
2. "Push Notifications: Manage your Apple Push Notifications Key."
3. "Set up a new push key" → EAS creates one in your Apple Developer
   account and stores it server-side. You never see the key file
   directly, which is the safe default.

You can verify with:
```bash
eas credentials --platform ios
# expand the current profile → "Push Key": should show a key ID + team ID.
```

For Android (FCM), if you're shipping there too:
```bash
eas credentials --platform android
```
…and follow the prompts to upload your `google-services.json` /
FCM Server Key. Expo's docs at
[docs.expo.dev/push-notifications/fcm-credentials/](https://docs.expo.dev/push-notifications/fcm-credentials/)
have screenshots if you get stuck.

---

## 2. Enable push in `app.json`

Add the iOS push entitlement and Notifications config block. Final
relevant slice of `app.json`:

```jsonc
{
  "expo": {
    // ... existing config ...
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.rankr.app",
      "infoPlist": {
        // Required if your app touches the user's calendar / camera / etc.
        // None of those apply to push, but Apple still requires the
        // notifications usage string when you call requestPermissionsAsync.
      }
    },
    "android": {
      "package": "com.rankr.app",
      // FCM service config file goes here, OR uploaded via `eas credentials`.
      "googleServicesFile": "./google-services.json"
    },
    "plugins": [
      // ... existing plugins ...
      [
        "expo-notifications",
        {
          "icon": "./assets/images/notification-icon.png",
          "color": "#7C3AED",
          "sounds": []
        }
      ]
    ]
  }
}
```

After editing `app.json` you must run `eas build` again — config plugins
affect the native project, so OTA updates won't pick them up.

---

## 3. Client-side: request permission + register the token

`lib/pushTokens.ts` (backend-dev's deliverable) exposes:

```ts
import { registerPushToken, unregisterPushToken } from '@/lib/pushTokens';
```

Frontend-dev wires it into the app lifecycle. Approximate shape (drop
into `app/_layout.tsx` or a similar root-level component):

```tsx
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { registerPushToken } from '@/lib/pushTokens';

// Foreground-display behaviour (default-ish):
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function setupPush() {
  // Skip in dev / Expo Go where push isn't supported on bare device limits.
  if (Platform.OS === 'web') return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return; // user said no — nothing to register.

  const tokenResult = await Notifications.getExpoPushTokenAsync({
    // Replace with your real EAS projectId — find it in `app.json` under
    // `expo.extra.eas.projectId` after `eas init`.
    projectId: 'YOUR-EAS-PROJECT-ID',
  });

  await registerPushToken(tokenResult.data);
}

export default function RootLayout() {
  useEffect(() => {
    // Only register once we know the user is signed in.
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setupPush().catch((e) => console.warn('[push setup]', e));
      }
    });
    return () => { sub.data.subscription.unsubscribe(); };
  }, []);
  // ...
}
```

On sign-out call `unregisterPushToken(token)` with the token you cached
from `getExpoPushTokenAsync`. Easiest pattern: stash the token in a
top-level state (Zustand / Context) so the sign-out handler can read it
and call `unregisterPushToken` before `supabase.auth.signOut()`.

---

## 4. Deploy the Edge Function

`docs/edge-functions/send-push-notification.ts` is the sender. Follow
`docs/edge-functions/README.md` to deploy:

```bash
mkdir -p supabase/functions/send-push-notification
cp docs/edge-functions/send-push-notification.ts \
   supabase/functions/send-push-notification/index.ts
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<paste-key>
supabase functions deploy send-push-notification
```

Smoke-test it from a curl:
```bash
curl -X POST https://<project-ref>.functions.supabase.co/send-push-notification \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": ["<your-test-user-uuid>"],
    "title":    "Hello",
    "body":     "Push from Rankr",
    "data":     { "screen": "home" }
  }'
```

If your test device received it: you're done with the plumbing.

---

## 5. Trigger pushes from the database

You probably want a notification on every new like / comment / watched-with
tag. Add a Postgres trigger that calls the Edge Function via `pg_net`:

```sql
-- One-time: enable pg_net (Supabase ships with it but it must be enabled).
CREATE EXTENSION IF NOT EXISTS pg_net;

-- One-time: stash the service-role key as a DB-level setting so triggers
-- can read it without it ever appearing in the mobile bundle.
-- Run in the Supabase SQL Editor exactly once:
--   ALTER DATABASE postgres SET app.service_role_key = '<paste-key>';
-- After this, every new connection sees current_setting('app.service_role_key').

-- Project URL helper: same trick, so the URL isn't baked into trigger code.
--   ALTER DATABASE postgres SET app.project_url = 'https://<project-ref>.functions.supabase.co';

CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  owner_id   uuid;
  item_title text;
  url        text;
  key        text;
BEGIN
  -- Find the item's owner.
  SELECT l.user_id, li.title
    INTO owner_id, item_title
  FROM public.list_items li
  JOIN public.lists      l  ON l.id = li.list_id
  WHERE li.id = NEW.list_item_id;

  -- Don't notify self-likes (matches `lib/notifications.ts` policy).
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  url := current_setting('app.project_url',     true) || '/send-push-notification';
  key := current_setting('app.service_role_key', true);

  PERFORM net.http_post(
    url     := url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || key
    ),
    body := jsonb_build_object(
      'user_ids', jsonb_build_array(owner_id::text),
      'title',    'New like',
      'body',     'Someone liked "' || COALESCE(item_title, 'your item') || '"',
      'data',     jsonb_build_object(
        'list_item_id', NEW.list_item_id::text,
        'kind',         'like'
      )
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

Mirror functions for `comments` and `watched_with`:
```sql
-- comments: notify the list owner when someone else comments on their item.
-- watched_with: notify the TAGGED user when they're tagged.
```
Both follow the same pattern: look up the recipient via the parent
`list_item.list.user_id` (for comments) or `NEW.tagged_user_id` (for
watched_with), build a `body` string, `PERFORM net.http_post(...)`.

---

## 6. End-to-end checklist

Before declaring push "done":

- [ ] `expo-notifications` added to `package.json` (frontend-dev).
- [ ] APNs key set up via `eas credentials --platform ios`.
- [ ] (Android) FCM credentials set up via `eas credentials --platform android`.
- [ ] `app.json` updated with the `expo-notifications` plugin block.
- [ ] `eas build` produces a fresh native binary (OTA can't ship native
      config changes).
- [ ] Test build installed on a real device — the iOS simulator and
      Android emulator do NOT receive push.
- [ ] `PHASE-5-MIGRATION.sql` applied → `push_tokens` table exists.
- [ ] `send-push-notification` Edge Function deployed.
- [ ] `app.service_role_key` and `app.project_url` set at the database
      level (one-time `ALTER DATABASE` calls in step 5).
- [ ] At least one trigger function created — e.g. `notify_on_like`.
- [ ] Tested end-to-end: device A likes device B's item → device B
      receives a push within ~5 seconds.

---

## Common gotchas

**Simulator silence.** iOS Simulator + Android Emulator never receive
real push notifications. Test on a physical device built via EAS.

**"Invalid expo push token" from the Expo API.** The token's project
ID doesn't match the project the Expo API thinks you're sending to.
Make sure `getExpoPushTokenAsync({ projectId })` matches the EAS
project ID and that you've actually built / deployed under that project.

**"Push notifications: not entitled."** Apple. Bundle ID in `app.json`
must match what's registered in App Store Connect, and the APNs key
must be associated with the same team. `eas credentials --platform ios`
should resolve this; if it doesn't, re-run with
`eas credentials --platform ios --clear-credentials` and let EAS
regenerate everything.

**Trigger fires but no push arrives.** Hit the Edge Function URL
manually with curl first (step 4 smoke test). 90% of the time the
trigger is fine and the function deploy is missing the service-role
secret.
