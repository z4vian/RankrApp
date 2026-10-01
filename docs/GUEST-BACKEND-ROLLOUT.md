# Guest-first backend rollout

Repository implementation only. No live migration or production mutation was performed.

## Client contract

`lib/guestDraft.ts` exports `GuestDraft`, `GuestDraftItem`, `GuestCategory`, `getGuestDraft`, `saveGuestDraft`, `clearGuestDraft`, `createGuestDraft`, `validateGuestDraft`, `isGuestDraftPersistenceAvailable`, and the item/TTL limits. Ordered items are the ranking order. IDs are UUIDs and optional external IDs are strings.

Guest drafts use no network. The web browser stores one JSON draft under `rankr.guest-draft.v1`, with at most 20 items and a seven-day inactivity TTL. A successful save refreshes the TTL. Expired or invalid drafts are discarded when read. This is local, unencrypted browser storage; users and scripts with access to the browser origin can read it. The TTL is enforced on access, not by a background deletion process. A shared browser shares this guest draft. Clearing site data removes it.

Blocked/unavailable localStorage falls back to module memory. `isGuestDraftPersistenceAvailable()` reports whether durable storage is currently usable; the UI should explicitly warn that closing/reloading may lose a memory-only draft. Native persistence is memory-only in this implementation. Creation uses browser `crypto.randomUUID` when available and lazily falls back to the installed `expo-crypto` module on native. If both are unavailable it reports a friendly error. Native UUID behavior has not been verified on a device. No preauthentication database writes or anonymous Auth users are created by these modules.

`importGuestDraft(draft)` checks the authenticated user, then calls one `rankr_import_guest_list` RPC. It never makes individual client list/item inserts. It returns `{id,title,category}` only after server confirmation. The caller should retain the draft on authentication, network, validation or database errors; clear it only after success and successful transition into the saved list. A missing response after a committed transaction is safe to retry using the unchanged draft UUID.

## Migration contract

Apply `202609300003_guest_list_import.sql` after verifying the existing live schema contains the documented list and item columns, visibility values, UUID primary keys and foreign keys. Historical schema docs are not proof of deployed state. The migration adds a private import ledger and one SECURITY DEFINER RPC with an empty search path; only `authenticated` can execute it, and it rejects a missing `auth.uid()`.

The server supplies the owner, forces private visibility and validates all items before writing. It bounds payload size, items, strings, categories and image schemes. `/media/...` references and HTTPS artwork URLs are accepted without fetching their contents. At import, validated `/media/...` paths become absolute `https://rankr-app.vercel.app/media/...` URLs so saved lists can display artwork in native clients. Existing HTTPS URLs remain unchanged. Anonymous drafts keep their relative refs; the client does not convert localhost or preview origins into persisted URLs. Self-hosted deployments must change this canonical fallback origin in the RPC migration before applying it, and serve the same media paths there. Local file/blob/data and unsafe path references are rejected.

The list ID is the draft UUID, item IDs come from the validated draft, and `(owner_id,draft_id)` identifies the import. Repeated imports return the first imported list without overwriting later edits. A UUID already used by an unrelated list, another owner or an existing item causes the whole import to fail; there is no silent reassignment. A transaction-level advisory lock serializes concurrent retries of the same draft. The ledger cascades when its list/account is deleted, so a stale retained draft may be recreated after deletion; normal clients clear it on successful import.

Scores mirror the existing drag reorder calculation: evenly spaced 10 through 1, or 10 for one item, rounded to two decimals. Items are not bookmarked. Sentiment remains null because rank position alone does not establish like/dislike intent. Existing comparison flows that partition by sentiment should prompt for sentiment rather than infer it.

This RPC writes existing plaintext application columns. It does not complete the separate encrypted-content migration, change profiles/onboarding fields, upload photos, or expose a public list. Do not claim application-layer encryption of guest imports. Client-side HTTPS artwork loading is distinct from this module's no-network persistence; a UI rendering remote artwork can make network requests before sign-in.

## Staging verification and limits

1. Inspect live schema/RLS/grants and backup before applying the additive migration. Test with the minimum deployed client/schema versions.
2. Test two staging identities and an unauthenticated caller: owner binding, privacy, one-item and 20-item lists, malformed payloads, concurrent retries, UUID collisions, and failure/retry behavior.
3. Test browser reload, blocked storage, expired/malformed local JSON, auth redirects and confirmed-success draft clearing. Ensure failures keep the draft and show a retry action.
4. Verify the saved list renders, sorts, and can be edited. Check nullable sentiment behavior. Keep native onboarding out of rollout until its persistence/crypto/artwork behavior is explicitly supported.

Verified locally: app TypeScript; Node draft validation, retention and memory fallback tests; isolated PostgreSQL 15 fixture verifying auth, ownership, private visibility, scores, idempotency, malformed data and rollback after an item-key collision. The fixture is intentionally minimal and is not a live Supabase integration test. Request-rate abuse controls, production schema drift, native durable storage and real authentication redirect behavior were not tested or implemented here.

## Web onboarding rollout

Landing create-list actions now open `/try`. Visitors can add up to 20 titles, change their order, compare their top two and undo before signing in. Save opens signup or login, preserving the browser draft; the signed-in confirmation imports it privately. Failed imports keep the draft, and retries use the same UUID.

New accounts receive a four-step introduction if they have no list, or a three-step refresher after importing a guest list or when an owned list already exists. Returning accounts with an established username are not forced through a new tour. Skip and completion store the walkthrough version in Auth metadata. Settings can replay the full introduction without resetting that preference. Profile creation and legal agreement remain separate required account steps.

Local verification: TypeScript and web export passed; three grouped Node tests passed; isolated PostgreSQL assertions passed. Mocked-auth browser checks at 1440px and 390px verified draft persistence, keyboard ordering, comparison undo, signup handoff, failed import/retry, successful draft clearing, full and short tour routing, skip and replay. Twelve captured screens had no axe WCAG A/AA violations, horizontal overflow or runtime errors. These checks do not verify real email verification, OAuth redirects, native devices or live database policies.

Before deploying the client, apply migration `202609300003_guest_list_import.sql` with the linked Supabase CLI (`npx supabase db push --linked --dry-run`, then `npx supabase db push --linked`) and perform a real-account private-save check. This migration is additive; it does not migrate content into the encrypted-content table. The client has not been deployed as part of this feature.
