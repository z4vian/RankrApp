# Rankr — EAS Build + TestFlight Setup

A practical, copy-pasteable walkthrough for getting Rankr from "runs in
Expo Go on my laptop" to "installable from TestFlight on a friend's phone"
and ultimately "live on the App Store."

> EAS (Expo Application Services) is Expo's cloud build pipeline. You can
> build locally too, but EAS is what nearly every Expo project ships with
> because it handles signing keys, native dependencies, and submission
> uploads for you.

---

## Prerequisites

- [x] An Expo account. Same one you use to run the dev server with
  `npx expo start` is fine.
- [x] Apple Developer Program membership ($99/year). Required for any iOS
  distribution, even internal TestFlight builds.
- [x] (For Android Play Store) A Google Play Console account ($25 one-time).
  Skip this section if you're iOS-only for now.
- [x] EAS CLI installed:
  ```bash
  npm install --global eas-cli
  # or use npx eas-cli per-command (no install needed)
  ```

---

## Step 1 — Log in

```bash
eas login
```

Use your existing Expo credentials. Confirm with:
```bash
eas whoami
# rankr-team-account
```

---

## Step 2 — Configure the project for EAS

From the repo root:

```bash
eas build:configure
```

This is interactive:
- Pick which platforms to set up (`iOS`, `Android`, or both).
- Confirm the project slug (matches `expo.slug` in `app.json`).
- It writes a new `eas.json` to the repo root with three default build
  profiles: `development`, `preview`, `production`.

**Do not commit any generated key files** — they're typically in
`~/.eas` or your keychain, not the repo. EAS handles signing keys for you.

Optional but recommended: open `eas.json` and confirm the `production`
profile has `"distribution": "store"` (the default).

---

## Step 3 — Internal testing build (TestFlight-ready)

A **preview** build is meant for internal testers — it's signed for
distribution but doesn't get submitted to the App Store yet.

```bash
eas build --platform ios --profile preview
```

The first iOS build of any project will walk you through:
1. Logging into your Apple Developer account (App-Specific Password or
   web-based 2FA — EAS does this for you).
2. Choosing a bundle identifier (e.g. `com.rankr.app`). **Pick once and
   never change it** — App Store Connect treats it as the app's PK.
3. Letting EAS generate a Distribution Certificate and Provisioning
   Profile, or uploading existing ones if you have them.

Wait ~15–30 minutes (build time is the EAS Free Tier's slowest knob).
You'll get a link like:
```
https://expo.dev/accounts/<acct>/projects/rankr/builds/<id>
```
That page has a "Submit" button — or use the CLI:

```bash
eas submit --platform ios --latest
```

This uploads the .ipa to App Store Connect. Open
[appstoreconnect.apple.com](https://appstoreconnect.apple.com) → TestFlight
→ add testers (internal: just by Apple ID; external: requires Beta App
Review, which is light-touch and usually approved in <24 h).

Android equivalents:

```bash
eas build  --platform android --profile preview
eas submit --platform android --latest
```

---

## Step 4 — Production / App Store build

```bash
eas build --platform ios --profile production
```

Same process as preview, but the resulting build is intended for App Store
release. After it finishes:

```bash
eas submit --platform ios --latest
```

This uploads to App Store Connect. To actually ship:

1. Open App Store Connect → Apps → Rankr → "+ Version".
2. Fill out the metadata: screenshots, description, age rating, privacy
   policy URL, support URL.
3. Pick the build you just uploaded under "Build".
4. Click "Submit for Review". Apple's review takes 24–72 hours typically.

Android Play Store equivalent:
```bash
eas build  --platform android --profile production
eas submit --platform android --latest
```

---

## Step 5 — Over-the-air (OTA) updates

EAS Update lets you push JavaScript-only changes (no native code) to
already-installed apps without going through TestFlight / Play review.

```bash
eas update --branch production --message "Fix Home feed crash"
```

Set up once with:
```bash
eas update:configure
```
…which adds the runtime version + channel config to `app.json` and
`eas.json`.

**Important:** any change that touches a native module (new
`expo install` of a package with native code) requires a fresh native
build via `eas build`. JS-only fixes ride OTA.

---

## Costs

EAS Free Tier (current pricing — check
[expo.dev/pricing](https://expo.dev/pricing)):
- 30 free builds per month (combined iOS + Android).
- 1,000 OTA updates per month.
- Subsequent builds: $1–2 each depending on platform, or a $19/mo
  Production plan with 100 builds.

Apple Developer: $99/year, mandatory for App Store distribution.
Google Play: $25 one-time, mandatory for Play Store distribution.

For a small-team app shipping ~weekly the Free Tier is enough.

---

## Troubleshooting

**"Apple credentials not found"** — `eas credentials` to inspect / fix.
EAS can regenerate everything from your Apple ID.

**Build fails on a native module** — most often this is because the
module was added to `package.json` but the native side wasn't installed
(`npx expo install <pkg>` does both). Re-run `eas build`.

**TestFlight rejects the build** — usually missing `NS*UsageDescription`
strings in `app.json`. Apple now requires every iOS API that touches
camera / mic / photos / push to have a user-facing description string
under `expo.ios.infoPlist`. See `docs/PUSH-NOTIFICATIONS-SETUP.md` for
the push-specific entries.

**Submit fails with "Invalid bundle identifier"** — the bundle ID in
`app.json` (`expo.ios.bundleIdentifier`) must match what's registered
in App Store Connect. They diverge if you ever change the slug.
