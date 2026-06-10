# Rankr — Beta Readiness Checklist

Everything that needs to be true before opening the public beta. The "Code-side" section is already shipped in this push; the "Required manual steps" section is action items for the operator (you) — they can't be automated from the codebase.

> Read alongside: `docs/PHASE-8-MIGRATION.sql`, `docs/edge-functions/README.md`, `docs/EAS-SETUP.md`, `docs/PUSH-NOTIFICATIONS-SETUP.md`.

---

## Code-side (already in this push)

- [x] **User blocking + reporting** — `docs/PHASE-8-MIGRATION.sql` adds the `user_blocks` and `reports` tables; `lib/moderation.ts` exposes `blockUser`, `unblockUser`, `isBlocked`, `getBlockedUserIds`, `getBlockedUsers`, `submitReport`.
- [x] **In-app feedback submission** — `feedback` table + `lib/feedback.ts → submitFeedback`. Supports anonymous submission for crash reports that fire before sign-in.
- [x] **Sentry crash + error tracking** — wired client-side by frontend-dev; this push includes the env-var plumbing for `EXPO_PUBLIC_SENTRY_DSN`.
- [x] **Password reset flow** — handled by frontend-dev's `app/reset-password.tsx` against Supabase Auth's standard reset URL.
- [x] **Privacy + ToS placeholder pages** — committed as `app/privacy.tsx` and `app/terms.tsx`. **Step 6 below covers the legal-text swap.**

---

## Required manual steps before launch

These run **once**, in order. None require code changes — they're all dashboard / CLI work.

### 1. Apply the Phase 8 SQL migration

Run `docs/PHASE-8-MIGRATION.sql` against the production Supabase project.

1. Supabase Dashboard → **SQL Editor** → **New query**.
2. Paste the entire contents of `docs/PHASE-8-MIGRATION.sql`.
3. Click **Run**.
4. Spot-check with the verification SELECTs commented under each section.

Adds three tables: `user_blocks`, `reports`, `feedback`, plus indexes and RLS policies. Idempotent — safe to re-run.

### 2. Deploy the account-deletion edge function

The source lives at `docs/edge-functions/delete-account.ts`. Apple's App Store guideline 5.1.1(v) requires apps that support account creation to also offer account deletion from inside the app. We have the client-side helper (`lib/account.ts → requestAccountDeletion`), but it relies on this edge function to actually delete the `auth.users` row via the service-role admin API.

From the project root:

```bash
mkdir -p supabase/functions/delete-account
cp docs/edge-functions/delete-account.ts supabase/functions/delete-account/index.ts
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<paste-from-dashboard>
supabase functions deploy delete-account
```

See `docs/edge-functions/README.md` for full deployment notes and a curl smoke-test.

**Without this step:** the in-app "Delete account" button will succeed at deleting the user's owned rows but leave the `auth.users` row intact, so they can sign back in and see a half-empty account.

### 3. Set up Resend SMTP for transactional email

Supabase's built-in SMTP rate-limits to 2 emails per hour — fine for development, broken for any real signup flow. Required before turning on email confirmation in step 4.

1. Sign up at [resend.com](https://resend.com) (free tier: 100 emails/day, 3000/month).
2. Verify the sending domain you want to use (or use Resend's onboarding domain for now).
3. Generate an SMTP password under **Settings → API Keys** (or **SMTP**, depending on UI version).
4. Supabase Dashboard → **Authentication** → **SMTP Settings** → fill in:
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: *(the Resend API key from step 3)*
   - **Sender email**: e.g. `noreply@your-domain.com`
   - **Sender name**: e.g. `Rankr`
5. Save.
6. Then go to **Authentication** → **Sign In / Up** → **Email** → toggle **"Confirm email"** to **ON**.

### 4. Tighten Supabase password policy server-side

The frontend already has client-side validation, but a motivated attacker can bypass it by calling the Supabase JS client directly. Belt-and-suspenders: also configure the server-side rule.

Supabase Dashboard → **Authentication** → **Policies** → **Password Requirements**:

- **Minimum length**: `8`
- **Required character types**: check **"Lower case letters"** + **"Numbers"** at minimum.

(More restrictive policies are fine; just keep them in sync with whatever the signup screen shows the user.)

### 5. Set up Sentry

Free tier covers 5k events/month, which is enough for a small beta.

1. Create a Sentry project at [sentry.io](https://sentry.io) → choose **React Native** as the platform.
2. Copy the DSN from **Settings → Client Keys (DSN)**. It looks like `https://abc123@o12345.ingest.sentry.io/67890`.
3. Set the DSN as an env var in two places:
   - **Local development**: append to `.env`:
     ```
     EXPO_PUBLIC_SENTRY_DSN=<paste-dsn-here>
     ```
   - **Vercel (web deployment)**: Project → **Settings** → **Environment Variables** → add `EXPO_PUBLIC_SENTRY_DSN` for both **Production** and **Preview**. Then redeploy (Vercel doesn't auto-rebuild on env-var changes).

> Note for backend-dev: `lib/apiKeys.ts` already uses the `requireKey` pattern for `EXPO_PUBLIC_*` vars. Sentry init code is owned by frontend-dev; this checklist just covers the env-var setup so the DSN is available when their code runs.

### 6. Replace placeholder Privacy + ToS text

The committed pages `app/privacy.tsx` and `app/terms.tsx` ship with **generic placeholder text only**. Apple, Google, and many jurisdictions require accurate, app-specific privacy policies and terms of service. Replace before public beta.

Options, cheapest to most expensive:

- [termly.io](https://termly.io) — free tier, generated templates.
- [privacypolicies.com](https://www.privacypolicies.com) — free + paid tiers.
- [iubenda.com](https://www.iubenda.com) — paid, more thorough.
- An actual lawyer — recommended once you have any meaningful revenue or PII.

At minimum, the policy must disclose:
- What data Rankr collects (email, username, profile data, ranked items, posts, follows, likes/comments, push tokens).
- That data is stored in Supabase (US-region by default — disclose data residency).
- Third-party APIs used (TMDB, RAWG, iTunes, Google Books, Expo Push, Sentry).
- How users can request data export or account deletion (already shipped — see `lib/account.ts`).
- Cookie / tracking behavior on web.

### 7. Configure Supabase Auth redirect URLs

For password reset and email confirmation links to work on the web build, the Supabase Auth allowlist needs to include your real domain(s).

Supabase Dashboard → **Authentication** → **URL Configuration** → **Redirect URLs** → add:

- `https://your-vercel-domain.vercel.app/reset-password`
- `https://your-vercel-domain.vercel.app/auth/callback` (if frontend-dev uses an OAuth callback route)
- `https://your-custom-domain.com/reset-password` (once you add a custom domain)
- For dev: `exp://*` and `rankr://*` (the Expo Go and custom-scheme entries should already be there from earlier work).

Mismatched redirect URLs cause Supabase to reject the magic-link callback with `redirect_to mismatch`. The error surfaces as a blank screen, which is hard to diagnose, so do this step early.

---

## Pre-launch smoke test

After running steps 1–7, do an end-to-end pass on a real device:

1. [ ] Sign up with a brand-new email → receive confirmation email (verifies Resend + step 4).
2. [ ] Confirm the email link → land on the app → complete onboarding.
3. [ ] Add a list + rank a few items.
4. [ ] Send a piece of feedback via the in-app form → confirm a row lands in `public.feedback`.
5. [ ] Trigger a deliberate client-side error → confirm an event appears in Sentry within ~30 seconds.
6. [ ] Sign out → use "Forgot password" → receive reset email → click link → land on `/reset-password` → set new password → sign in.
7. [ ] Block a test account → confirm their content disappears from your feeds.
8. [ ] Report a piece of content → confirm a row lands in `public.reports`.
9. [ ] Tap "Delete account" in settings → confirm the `auth.users` row is gone (check Supabase Dashboard → **Authentication** → **Users**).

If all nine pass, you're cleared for beta.

---

## What's deliberately deferred to Session 2

- **Admin moderation UI.** Reports are submitted; the queue is readable only via Supabase Dashboard for now. Session 2 will add an admin role + UPDATE/DELETE policies on `reports` and `feedback` + a `/admin` route.
- **Block-aware feed filtering.** `getBlockedUserIds` is implemented, but the feed queries (`getFeedPosts`, `getFeed`, recommendations) don't yet exclude blocked users server-side. v1 expectation is that the UI calls `getBlockedUserIds` and filters client-side; v2 will add server-side via RLS or query helpers.
- **Rate limiting on reports / feedback.** A single user could spam either endpoint. Mitigation: the moderation queue dashboard will surface per-user submission counts; aggressive spammers can be banned.
- **Email templates.** Supabase ships with reasonable defaults. Custom-branded templates live under **Authentication → Email Templates** — nice-to-have for polish, not blocking.
