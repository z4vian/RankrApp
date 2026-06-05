# Onboarding Flow — DEFERRED to Phase 5 (or whenever user prioritizes)

> Status: **Not yet built.** Captured here so the spec doesn't get lost while
> Phase 1 (schema groundwork) ships first. Re-read alongside
> `docs/social-schema.md` for the schema context that this flow depends on.

## User-described flow

```
Signup
  ↓
Profile creation (username, bio, avatar)
  ↓
Tutorial-style first-rank
  ↓
Completion → full app access
```

## Implementation sketch

1. After email/password signup OR Google OAuth, check the `profiles` row.
   If `username` is null → route to `/(onboarding)/create-profile` (a new
   Expo Router group).

2. `/(onboarding)/create-profile`
   - Username field with live availability check via
     `isUsernameAvailable(username)` from `@/lib/profile`. Debounce ~400 ms.
   - Show inline validation errors from `validateUsername(username)` on every
     keystroke (3–20 chars, lowercase / digits / underscore).
   - Bio field (multi-line `TextInput`, optional, 200-character limit).
   - Avatar upload — reuse the existing pipeline already used by
     `profile-settings.tsx` (uploads to the `avatars` bucket via the
     `arrayBuffer` approach).
   - "Next" button calls `createProfile({ userId, username, displayName, bio })`
     from `@/lib/profile`. On success, route to `/(onboarding)/first-rank`.
   - Handle the "username taken" error from `createProfile` — surface it on
     the username field, not as a global toast.

3. `/(onboarding)/first-rank`
   - Short explainer (one paragraph + a graphic) describing the
     binary-comparison algorithm:
     > "We'll show you two items at a time — pick the one you like more.
     > Over time we build your personal ranking. No stars, no 1-to-10 — just
     > head-to-head."
   - Pre-populate a default list (e.g. "Movies I've Watched") if the user
     has no lists yet. Insert into `lists` with `category = 'movies'` and
     `visibility = 'private'` (Phase 1 default).
   - Prompt the user to search + add 3–5 items using the existing search UI.
   - When the user adds an item, route them through the standard comparison
     flow already used in `app/(tabs)/search/movies.tsx`.
   - Provide a "Skip — I'll rank later" option.

4. After completion → `/(tabs)` (full app access).

5. **State tracking — schema change required.**

   Add a nullable timestamp to `profiles`:

   ```sql
   ALTER TABLE public.profiles
     ADD COLUMN IF NOT EXISTS onboarded_at timestamptz NULL;
   ```

   - Set `onboarded_at = now()` when the user finishes (or skips) the
     first-rank step.
   - In the root layout (`app/_layout.tsx`), on session restore, fetch the
     current user's `profiles.onboarded_at`. If null, redirect to
     `/(onboarding)/create-profile` regardless of how they entered the app.
   - This makes the flow robust against: app force-quit mid-onboarding,
     OAuth users whose `auth.users` row exists but who never completed
     profile setup, and existing pre-onboarding-feature users.

## Edge cases

- **OAuth users** — Google sign-in populates `user_metadata.full_name`. The
  create-profile screen should pre-fill `displayName` from that metadata so
  the user only has to choose a username. Username is never derived from
  email or Google name; the user always picks one explicitly.

- **Existing users (created pre-onboarding-feature)** — they have a row in
  `auth.users` and possibly a partial `profiles` row, but no `username`.
  Same flow as a fresh signup: the root-layout check on `onboarded_at`
  routes them to `/(onboarding)/create-profile` on next session start.

- **Skipping first-rank** — must still set `onboarded_at` so they don't get
  bounced back into onboarding next session.

- **Username uniqueness race** — `createProfile` throws "That username is
  already taken." on the database unique-violation (code 23505). Catch and
  show inline. The availability check is advisory only.

- **Account deletion** (Phase 5) — when account is deleted, `auth.users` is
  removed; FK cascade from `profiles.id` should remove the profile too. Make
  sure the FK is defined with `ON DELETE CASCADE` (verify in Supabase
  dashboard during the account-deletion implementation pass).

## Dependencies

| Dependency                                      | Status                       |
|-------------------------------------------------|------------------------------|
| `profiles.username` partial unique index        | Shipped in Phase 1 migration |
| `lib/profile.ts` (`createProfile`, `validateUsername`, `isUsernameAvailable`) | Shipped in Phase 1 |
| `profiles.onboarded_at` column                  | **TODO** — add migration when onboarding ships |
| `profiles.is_public` column                     | Shipped in Phase 1 migration |
| Existing avatar upload pipeline                 | Already exists (`profile-settings.tsx`) |
| Existing search + ComparisonSheet flow          | Already exists per category |

## Open questions

- Should we let users *skip* setting a username and assign a default
  (e.g. `user_a1b2c3`)? Current design says NO — username is required to
  finish onboarding. Revisit if drop-off is high.
- Should the first-rank tutorial be per-category (movies first, then games,
  then music)? Or a single category the user picks? Current sketch: user
  picks one category to start with, can add more later from the lists tab.
- Should the avatar be optional in the create-profile step? Current sketch
  says yes (Skip button on avatar). Some social apps require it; depends on
  product feel.
