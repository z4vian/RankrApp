# Rankr — Session Changelog

Complete record of every change across the multi-session build, from initial runtime-bug investigation through Phase 5 of the social roadmap.

---

## Session 0 — Initial Triage + Stabilization

**Problem reported:** runtime crash on `expo start --web` — `ReferenceError: window is not defined`.

### Root cause
`app.json` has `"web": { "output": "static" }`, which enables server-side rendering at bundle time. `lib/supabase.ts` was passing `AsyncStorage` as the Supabase auth `storage` adapter. On web, `@react-native-async-storage/async-storage` accesses `window.localStorage` — which doesn't exist during SSR (Node.js context).

### Fix shipped (1-line patch)
[lib/supabase.ts](../lib/supabase.ts) — `storage: AsyncStorage` → `...(Platform.OS !== 'web' && { storage: AsyncStorage })`. On web Supabase falls back to its own `localStorage` adapter in browser / in-memory during SSR.

### Stabilize pass (first agent team — `rankr-stabilize`)

Two parallel Sonnet teammates: `backend-dev` (Supabase/SQL specialist) + `frontend-dev` (React Native/iOS specialist).

**Files created**
- [docs/database-schema.md](database-schema.md) — full inferred schema with FK relationships, recommended indexes, recommended RLS policies, 9-item GAPS/SUSPICIOUS section
- [lib/queries.ts](../lib/queries.ts) — `fetchRecentItemsWithListTitles(limit)` (single-query replacement for Home N+1) + `RecentItem` type
- [lib/photoUpload.ts](../lib/photoUpload.ts) — `uploadListItemPhoto(uri, userId)` helper that uploads local file://, blob:, or HTTP URIs to a Supabase Storage bucket (`list-item-photos`) and returns the public URL. Works on iOS, Android, web (with ArrayBuffer fallback for SDK quirks).

**Files modified**
- 4 search/auth screens — fixed unescaped apostrophe ESLint errors (`'` → `&apos;`)
- All three search screens + `app/(tabs)/profile-settings.tsx` + `app/(tabs)/lists/[id].tsx` — gated `expo-image-picker` calls behind `Platform.OS !== 'web'` to avoid web crashes
- `app/(tabs)/index.tsx` — Home screen N+1 replaced with single `fetchRecentItemsWithListTitles(20)` call
- All three search screens — photo upload wired to `uploadListItemPhoto`; raw `file://` URIs no longer persisted
- `app/(tabs)/search/movies.tsx` — race condition fix in `handleSaveBookmark` (was reading stale `selectedList` from state)
- All three search screens — sentiment-priority sort of initial-10 batch ranking; rank clamping to [1, 10]; corrected score-range UI labels to match actual code thresholds
- `app/(tabs)/recommendations.tsx` — stub replaced with polished "Coming Soon" empty state (this was later fully replaced in For You v1)

**Manual step required at time of shipping**
- Create `list-item-photos` bucket in Supabase Storage → Public ON

---

## Session 1 — For You v1 (recommendations engine — first pass)

User asked for an AI-powered recommendations tab. After discussion, agreed to use built-in API recommendations (TMDB/RAWG/iTunes) as v1 rather than build a custom genre-similarity algorithm.

**New agent team:** `rankr-foryou` (same backend/frontend Sonnet teammates).

### Files created
- [lib/apiKeys.ts](../lib/apiKeys.ts) — centralized `TMDB_API_KEY` + `RAWG_API_KEY` constants (single source of truth, replacing 3 hardcoded copies in search screens)
- [lib/recommendations.ts](../lib/recommendations.ts) — `RecItem` type + three per-category fetchers (`fetchMovieRecommendations` via TMDB `/recommendations`, `fetchGameRecommendations` via RAWG `/suggested`, `fetchMusicRecommendations` via iTunes artist+genre lookups) + three trending fallbacks (`fetchTrendingMovies`/`Games`/`Music`). Variety cap of max 2 recs per source item, dedup against `excludeIds`, hard cap at `limit`.
- [lib/recommendationsCache.ts](../lib/recommendationsCache.ts) — 24h AsyncStorage cache. Web no-op shim so SSR doesn't crash. `getCachedRecs`, `setCachedRecs`, `invalidateRecsCache`.
- [lib/itemDetails.ts](../lib/itemDetails.ts) — per-category detail fetchers returning `MovieDetail` (with cast + US watch providers), `GameDetail` (with platforms + ESRB + screenshots), `MusicDetail` (with 30-sec preview audio URL).

### Files added (frontend)
- [app/item/_layout.tsx](../app/item/_layout.tsx) — Stack navigator with slide-from-right animation
- [app/item/[category]/[externalId].tsx](../app/item/%5Bcategory%5D/%5BexternalId%5D.tsx) — full detail screen: hero image, category-specific extras (cast for movies, screenshots for games, audio preview for music via expo-web-browser), sticky "Add to list" / "Save for later" action bar, list-picker bottom sheet

### Files modified
- [app/(tabs)/recommendations.tsx](../app/(tabs)/recommendations.tsx) — full rewrite: 3-tab segmented control (Movies/Games/Music), 2-column card grid, "Because you liked X" attribution badges, pull-to-refresh, trending fallback for empty-state users, cache wiring
- [app/_layout.tsx](../app/_layout.tsx) — registered the new `item` route group

### Key behaviors
- 24h cache check per category; pull-to-refresh invalidates and refetches
- Hide already-ranked items via cross-list exclude set
- TMDB `/recommendations` (preferred) with `/similar` as fallback
- RAWG `/games/{id}/suggested` (requires numeric ID — confirmed compatible with existing search storage)
- iTunes has no "similar" endpoint → combined "artist's other tracks" + "genre search" strategy
- Trending fallback for users with zero ranked items in a category

---

## Session 2 — For You v2 (per-list redesign + games bug fix)

User reported: games tab in For You wasn't showing recommendations. Also requested redesign: recommendations should be **per-list** (e.g. a "Rap Songs" list and a "Country Songs" list each get distinct recs), Netflix-style.

**New agent team:** `rankr-foryou-v2` (added 3rd teammate later — `ui-ux-dev`). This team was kept alive across all subsequent phases.

### Bug fix — games tab
Two root causes confirmed:
1. **Stale hardcoded date filter** in `fetchTrendingGames` — `dates=2024-01-01,2025-12-31` (we're in mid-2026, so every recent game was excluded). Replaced with a rolling 1-year window computed at call time.
2. **Missing `external_id` guards** in all three category recommenders — null/empty IDs produced malformed URLs (`/games//suggested`) that 404'd silently. Now filter `validSources = sources.filter(s => s.external_id)` upstream of `Promise.all`.

Added `console.error('[rec]', ...)` logging in every per-source catch block so future failures show up in dev logs.

### Per-list redesign
**Files modified**
- [lib/queries.ts](../lib/queries.ts) — added `fetchUserLists`, `fetchTopRankedInList`, `fetchAllExternalIdsInList`, `UserList` type
- [lib/recommendations.ts](../lib/recommendations.ts) — added `fetchRecommendationsForList(listId, listTitle, category)` wrapper returning `{ items, is_trending }`
- [lib/recommendationsCache.ts](../lib/recommendationsCache.ts) — per-list cache keys: `getCachedRecsForList`, `setCachedRecsForList`, `invalidateRecsCacheForList`, `invalidateAllListRecsCache`. Extended `StorageShim` to support bulk-clear via `getAllKeys` + `multiRemove`.
- [app/(tabs)/recommendations.tsx](../app/(tabs)/recommendations.tsx) — full rewrite: vertical scroll of per-list sections inside each category tab, each section is a horizontal carousel of recs, subtitle switches between "Because you ranked items in this list" / "Trending right now" based on `is_trending`

### Cleanup pass
Frontend-dev initially wrote per-list orchestration inline; cleanup swapped inline → library imports. Net delta: −181 LOC. Same source of truth for cache keys + game-bug fixes.

---

## Documentation interlude

User asked to add `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` to `.claude/settings.local.json` and requested a master reference doc for agent teams.

**Files created**
- `.claude/settings.local.json` — env var added alongside existing permissions
- [docs/agent-teams-reference.md](agent-teams-reference.md) — 18-section reference guide covering enablement, architecture, display modes, spawning, coordination, hooks, best practices, limitations, troubleshooting

---

## Phase 1 — Social Foundation

User confirmed direction: build Beli-style social media app. Agreed on a 5-phase rollout. Phase 1 = foundation only, no user-visible social features.

### Database (manual step required — apply in Supabase Dashboard)
- [docs/PHASE-1-MIGRATION.sql](PHASE-1-MIGRATION.sql) — paste-ready, idempotent. Adds `lists.visibility` (public/private), `profiles.username` partial unique index (allowing null for un-onboarded users), `profiles.is_public`. RLS policies allow public lists / public list items / public profiles to be readable by anyone.

### Library code
- [lib/apiKeys.ts](../lib/apiKeys.ts) refactored — now reads `process.env.EXPO_PUBLIC_TMDB_API_KEY` / `EXPO_PUBLIC_RAWG_API_KEY`. Metro inlines `EXPO_PUBLIC_*` at build time (no app.json change needed).
- [lib/profile.ts](../lib/profile.ts) (NEW) — `createProfile`, `isUsernameAvailable`, `validateUsername` (3-20 lowercase alphanumeric + underscore), `CreateProfileInput` type. Username case-insensitive availability via `ilike`; database-level partial unique index is the authoritative race-condition check.

### Environment config
- `.env` — gitignored; contains the existing TMDB + RAWG keys so dev keeps working
- `.env.example` — committed template with empty values
- `.gitignore` — added `.env` and `!.env.example`

### Frontend
- [app/(tabs)/lists/create.tsx](../app/(tabs)/lists/create.tsx) — public/private segmented control with lock/globe icons (private default), also normalized old blue palette to app's purple/dark theme
- [app/(tabs)/lists/[id].tsx](../app/(tabs)/lists/%5Bid%5D.tsx) — visibility pill in cover area, optimistic toggle with revert on error
- [app/(auth)/signup.tsx](../app/(auth)/signup.tsx) — required username field above email, debounced live-availability check with ✓/✗/spinner, post-signup `createProfile` call with `signOut()` rollback on uniqueness conflict, email-confirmation case stashes `intended_username` in `user_metadata`
- [app/(tabs)/search/games.tsx](../app/(tabs)/search/games.tsx) + [movies.tsx](../app/(tabs)/search/movies.tsx) — hardcoded API key constants removed; imports from `@/lib/apiKeys`

### Documentation
- [docs/social-schema.md](social-schema.md) (~570 lines) — full schema design for ALL 5 phases (so we don't paint ourselves into a corner): existing tables + Phase 1/2/3/4 additions + RLS catalogue + ER diagram + open questions
- [docs/onboarding-flow-todo.md](onboarding-flow-todo.md) — deferred onboarding flow (signup → username → bio → tutorial first-rank → done) captured in detail with implementation sketch + edge cases

### Reconciliation
Frontend-dev initially inlined `validateUsername`/`isUsernameAvailable`/`createProfile` (column-name mismatch: `user_id` vs the real `id` PK). Cleanup pass swapped inline → library imports, also moving the search-screen API keys to `lib/apiKeys`.

---

## Phase 2 — Public Profiles + Follow Graph

Added 3rd teammate to the standing `rankr-foryou-v2` team: `ui-ux-dev`. New agent owns the design system; frontend-dev composes its components.

### Database (manual step)
- [docs/PHASE-2-MIGRATION.sql](PHASE-2-MIGRATION.sql) — `follows` table with composite PK `(follower_id, followed_id)`, CHECK (no self-follows), composite indexes `(follower_id, created_at DESC)` + `(followed_id, created_at DESC)` for paginated "newest follower" feeds. RLS: anyone can read who-follows-whom (Beli model); only the follower can insert/delete their own rows.

### Library code
- [lib/social.ts](../lib/social.ts) (NEW) — `followUser` (with "can't follow yourself" + "already following" guards), `unfollowUser` (RLS-idempotent), `isFollowing`, `getFollowers`/`getFollowing` (joined to profiles), `getFollowCounts`, `FollowUser` type
- [lib/profile.ts](../lib/profile.ts) extended — `fetchProfileByUsername` (case-insensitive, returns null on private/missing), `fetchProfileStats` (uses PostgREST inner-join `lists!inner(user_id)` for itemsCount), `searchUsers` (sanitizes PostgREST filter metacharacters `%`, `*`, `(`, `)`, `,` to prevent broken OR clauses), `PublicProfile` type
- [lib/queries.ts](../lib/queries.ts) extended — `fetchPublicListsByUserId`

### Design system — first batch
- [lib/theme.ts](../lib/theme.ts) (NEW) — central tokens sourced from existing screens: `colors` (bg/card/border + brand purple + semantic), `spacing` (xs–xxxl), `radius` (sm/md/lg/xl/pill), `typography` (h1/h2/h3/body/bodyBold/small/caption/micro), `shadow` (sm/md/lg, purple-tinted)
- [components/](../components/) (NEW directory) — 10 reusable visual components, all consume `lib/theme.ts`:
  - `Avatar` (image or initials fallback with purple-soft circle + 1px purple border)
  - `Button` (primary/secondary/ghost + loading + icon)
  - `Pill` (semantic badge)
  - `StatPill` (vertical value + label, tappable)
  - `FollowButton` (composes Button with follow/following state)
  - `ProfileHeader` (avatar + name + bio + 4-stat row + action button)
  - `UserRow` (avatar + name + trailing slot for follow button)
  - `EmptyState` (icon + title + subtitle + optional CTA)
  - `LoadingState` (branded spinner)
  - `index.ts` (barrel export)

### Frontend
- [app/profile/_layout.tsx](../app/profile/_layout.tsx) + [app/profile/[username]/_layout.tsx](../app/profile/%5Busername%5D/_layout.tsx) — nested Stack routes
- [app/profile/[username]/index.tsx](../app/profile/%5Busername%5D/index.tsx) — composes `ProfileHeader` with stats + follow button + lists section
- [app/profile/[username]/followers.tsx](../app/profile/%5Busername%5D/followers.tsx) + [following.tsx](../app/profile/%5Busername%5D/following.tsx) — follower/following lists with inline follow buttons, type-narrowed to filter out null usernames at load time (can't navigate to `/profile/null`)
- [app/users/_layout.tsx](../app/users/_layout.tsx) + [app/users/search.tsx](../app/users/search.tsx) — debounced (300ms) user search using `searchUsers`
- [app/_layout.tsx](../app/_layout.tsx) — registered `profile` and `users` route groups
- [app/(tabs)/profile.tsx](../app/(tabs)/profile.tsx) — added "Find friends" header icon → `/users/search`

### Reconciliation
Frontend-dev's initial pass created a `socialShim.ts` at the project root (race: backend-dev hadn't shipped yet). The shim used `followee_id` while everything else used `followed_id` (a real future-runtime bug if the user applied the SQL). Reconciliation pass swapped all 4 screens to library imports + deleted the shim, also adding the `LinkableUser` type narrow to handle the now-nullable `username` on `FollowUser`.

---

## Phase 3 — Engagement (likes + comments + watched-with) + Notifications

### Database (manual step)
- [docs/PHASE-3-MIGRATION.sql](PHASE-3-MIGRATION.sql) — `likes` (unique on `(user_id, list_item_id)`), `comments` (with edited_at + length check 1–500 of trimmed body), `watched_with` (unique on `(list_item_id, tagged_user_id)`), `profiles.notifications_last_seen_at` (timestamp, defaults to `now()` for existing rows so no retroactive unread storm). RLS: likes/comments readable on public items or own items; only list owners can tag others; either the list owner OR the tagged user can untag (consent safeguard).

### Library code
- [lib/engagement.ts](../lib/engagement.ts) (NEW) — likes (`likeItem`/`unlikeItem`/`hasUserLiked`/`getLikeCount`/`getLikedBy`), comments (`addComment`/`deleteComment`/`editComment`/`getComments`/`getCommentCount`), watched-with (`tagWatchedWith`/`untagWatchedWith`/`getWatchedWithUsers`). `Comment.author` inlined via PostgREST nested select. `editComment` bumps `edited_at` client-side. Idempotent on 23505 unique-violation. Trim-validation mirrors the database CHECK.
- [lib/notifications.ts](../lib/notifications.ts) (NEW) — derived from likes + comments + watched_with (no new notifications table). `getNotifications` runs three parallel queries filtered to "events on YOUR items by someone else" (excluding self-likes/self-comments via `.neq('user_id', me)`). `markNotificationsAsSeen` updates the `notifications_last_seen_at` timestamp; `is_unread` is computed client-side per row. All functions degrade to safe empty values on error — feed can never break the rest of the app. Watched-with notifications avoid N+1 by batching the actor-profile lookup.
- [lib/queries.ts](../lib/queries.ts) extended — `fetchListItemWithOwner(itemId)` returning flat `ListItemDetail` (top-level `list_user_id`/`list_title`/`list_visibility`, NOT nested). Returns null on RLS-hidden items (caller can't distinguish "not found" from "private and not visible").

### Design system — engagement components
- `LikeButton` (two-stage `Animated.spring` heart bounce — bounciness 12 up / 10 settle; hit-slop 8px)
- `CommentBubble` (avatar + author + body + own-only Delete button)
- `CommentInput` (multiline TextInput with auto-grow up to 4 lines, purple send-circle only when text non-empty, KeyboardAvoidingView)
- `EngagementBar` (composite: LikeButton + comment chip + WatchedWithStack/AddWatchedWith pill)
- `WatchedWithStack` (overlapping avatars with 2px purple ring between them via colors.bg wrapper, `+N` overflow chip)
- `UserTagPicker` (debounced 300ms search modal; accepts `search` as a prop so it doesn't reach into lib)
- `NotificationRow` (variant-specific text; italic+purple-light item title to signal clickable target; subtle unread purple tint)
- `RelativeTime` (pure formatter: "just now" / "Xm" / "Xh" / "Xd" / "Xw" / "jun 5" — all lowercase)

### Frontend
- [app/list-item/_layout.tsx](../app/list-item/_layout.tsx) + [app/list-item/[itemId].tsx](../app/list-item/%5BitemId%5D.tsx) — Phase 3 focal screen: hero + owner action bar + notes + photos + EngagementBar + comments thread + tag-watched-with modal + full-list watched-with modal
- [app/notifications.tsx](../app/notifications.tsx) — standalone notifications feed; `useFocusEffect` refetches + marks-as-seen on focus
- [app/_layout.tsx](../app/_layout.tsx) — registered `list-item` and `notifications` route groups
- [app/(tabs)/index.tsx](../app/(tabs)/index.tsx) — bell button with unread badge between greeting and add button; `useFocusEffect` refreshes count
- [app/(tabs)/lists/[id].tsx](../app/(tabs)/lists/%5Bid%5D.tsx) — row tap now routes to the new list-item detail (existing edit-sheet code preserved but no longer triggered — known tech debt)

### Coordination win
Frontend-dev adopted the "stub-then-swap" pattern in this phase (`_phase3Stubs.tsx`, deleted after wiring against canonical lib signatures). Single agent turn — no separate reconciliation pass needed. Pattern reused in Phase 4.

---

## Phase 4 — Posts/Notes Feed (with ranking events)

### Database (manual step)
- [docs/PHASE-4-MIGRATION.sql](PHASE-4-MIGRATION.sql) — `posts` table with three visibility levels (`private`/`followers`/`public`), `list_item_id` ON DELETE SET NULL (deleting an item doesn't erase posts about it — just detaches the embed), body length CHECK 1–1000. Three OR'd SELECT policies (author / public / follower-of-author), single INSERT + single DELETE policy. No UPDATE policy — posts are immutable in v1.

**Hard dependency: Phase 2 must be applied first.** The followers-visibility policy joins against `follows`.

### Library code
- [lib/posts.ts](../lib/posts.ts) (NEW) — `Post`, `PostVisibility`, `PostAttachedItem` types. `createPost` (returns full joined row including author + attached_item — no extra round-trip for optimistic UI), `deletePost`, `getPostById`, `getFeedPosts` (cursor-paginated via `beforeCreatedAt` ISO timestamp), `getPostsByUser` (RLS does the filtering — same query for self vs others).
- [lib/feed.ts](../lib/feed.ts) (NEW — amendment) — unified feed: posts + ranking events merged by `created_at` DESC. `FeedItem` is a discriminated union: `{ kind: 'post', post: Post } | { kind: 'ranking', event: RankingEvent }`. `RankingEvent.id` is synthesized as `"ranking:" + list_item.id` to avoid collision with post UUIDs. Uses a two-step profile-resolution pattern (fetch list_items + lists first, then batch-fetch profiles by user_id IN list) — same pattern as `lib/notifications.ts`'s watched-with actor resolution. Cursor pagination applies to both sub-queries.

### Design system — feed components
- `PostCard` (Twitter-style: avatar + display name + @username + visibility chip + RelativeTime + body + optional attached `ListItemPreviewCard`; `ellipsis-horizontal` overflow icon for delete to follow Twitter convention; Twitter-style indent gutter so attached content aligns under the author name)
- `VisibilitySelector` (three-pill segmented control: private/followers/public with icon + label per option)
- `ListItemPreviewCard` (compact 60×60 thumbnail + title + subtitle + category chip + optional score pill using the existing color ramp; placeholder uses purpleSoft tint with category-themed icon when image is missing)
- `ComposePostInput` (borderless multiline TextInput inside a wrapper card, optional attached `ListItemPreviewCard` with x-button to clear, char counter ramps from muted → attention → error as user approaches limit, pill-shaped Post button height 36 — feels like inline action not full-width CTA)
- `RankedItemCard` (final design after redesign pass): no nested card. Single integrated layout — author header on top, item row in middle with 48×48 inline thumbnail (purpleSoft+icon fallback) + title (flex 1, ellipsized) + score chip on the right (36×36 rounded square, color by 8/6/4 threshold ramp, `tabular-nums` so 8.4 and 10.0 don't shift width), "in {listTitle}" subtitle, notes body below. Same 52px gutter constant as PostCard so the two card types align when stacked.

### Frontend
- [app/post/_layout.tsx](../app/post/_layout.tsx) — Stack with `slide_from_bottom` (compose feels modal)
- [app/post/compose.tsx](../app/post/compose.tsx) — Twitter-style compose; reads optional `?listItemId=` and prefills attachment via `fetchListItemWithOwner`; on submit calls `createPost` then `router.back()`
- [app/(tabs)/index.tsx](../app/(tabs)/index.tsx) — **full rewrite**. Previous "Recent activity" view (N+1 fetch + quick-actions row + activity cards) entirely removed. Replaced with FlatList of `FeedItem` discriminated union: `'post'` → `PostCard`, `'ranking'` → `RankedItemCard`. Cursor pagination via `createdAtOf(item)` helper, dedup-on-append via `feedItemKey(item)`. Pull-to-refresh re-fetches. Compose button replaces the old `+`-to-search button. Bell button + unread badge preserved from Phase 3. "Your feed is empty" `EmptyState` with `/users/search` CTA.
- [app/list-item/[itemId].tsx](../app/list-item/%5BitemId%5D.tsx) — added owner-only "Share" button → `/post/compose?listItemId=...`
- [app/profile/[username]/index.tsx](../app/profile/%5Busername%5D/index.tsx) — added "POSTS" section under "PUBLIC LISTS"; uses `getPostsByUser` (RLS auto-filters by viewer)
- [app/_layout.tsx](../app/_layout.tsx) — registered `post` route group

### Coordination summary
Same stub-then-swap pattern as Phase 3. Frontend-dev used `_phase4Stubs.tsx` for ~30 minutes while backend/UI-UX shipped, then deleted after wiring against canonical signatures. Single reconciliation pass.

---

---

## Phase 5 — New Media Types, Insights, Account, Toasts, Push, EAS

The biggest phase. Five workstreams in parallel across the team. All shipped clean.

### Database (manual step)
- [docs/PHASE-5-MIGRATION.sql](PHASE-5-MIGRATION.sql) — `push_tokens` table with FK to `auth.users` (ON DELETE CASCADE), UNIQUE on `token`, `platform` CHECK ('ios'/'android'/'web'), `(user_id)` index. RLS: users manage only their own tokens. **Independent of prior phases** — no Phase 1-4 dependency.

### New media types: Books + TV
- [lib/recommendations.ts](../lib/recommendations.ts) extended — `RecCategory = 'movies' | 'games' | 'music' | 'books' | 'tv'` (widened uniformly across `lib/queries.ts` and `lib/recommendationsCache.ts` via `import type { RecCategory }`). Added `fetchTvRecommendations` (TMDB `/tv/{id}/recommendations` with `/similar` fallback), `fetchBookRecommendations` (parallel `inauthor:` + `subject:` Google Books queries through the existing dedup+variety pipeline), `fetchTrendingTv` (TMDB `/trending/tv/week`), `fetchTrendingBooks` (Google Books `q=bestseller` approximation). `fetchRecommendationsForList` dispatch widened.
- [lib/itemDetails.ts](../lib/itemDetails.ts) extended — `TvDetail` (with cast + US watch providers + episode_count_label like "5 seasons, 62 episodes"), `BookDetail` (authors + publish_year + page_count + categories + isbn). `ItemDetail` union widened.
- Google Books returns `http://` thumbnails — both files independently `upgradeBookImage` to `https://` so iOS App Transport Security accepts them.

### Year-in-Review insights
- [lib/insights.ts](../lib/insights.ts) (NEW) — `getYearInsights(year?)` returns: `total_items_ranked`, `total_lists_created`, top 5 ranked items, sentiment breakdown, category breakdown, most active month, average rank, posts made. UTC year boundaries (half-open `[Jan 1 00:00 UTC, next-year Jan 1 00:00 UTC)`). Never throws — returns zero values on missing data.

### Account: data export + deletion
- [lib/account.ts](../lib/account.ts) (NEW) — `exportUserData()` returns `ExportedUserData` bundle (profile, lists, list_items, posts, follows summary). `userDataToJSON` pretty-prints. `requestAccountDeletion()` does best-effort client-side cleanup in FK-cascade order (posts → comments → likes → watched_with → list_items → lists → push_tokens → profile) before invoking `delete-account` Edge Function. `exportUserData` is engineered to **never throw** — meets Apple/Google "data export must always be available" guidance.

### Push notification client
- [lib/pushTokens.ts](../lib/pushTokens.ts) (NEW) — `registerPushToken(expoPushToken)` uses upsert with `onConflict: 'token'` so reinstalls just bump `updated_at`. `unregisterPushToken` for logout cleanup.

### Edge functions (deploy targets)
Live under [docs/edge-functions/](edge-functions/) — Deno TypeScript source files for the user to deploy via `supabase functions deploy`. `@ts-nocheck` directive so the Deno code doesn't pollute the React Native tsconfig.
- `delete-account.ts` — verifies JWT, calls `auth.admin.deleteUser(jwt.sub)` with the service role key
- `send-push-notification.ts` — receives `{ user_ids, title, body, data }`, looks up tokens, batches to Expo's `/api/v2/push/send`
- `README.md` — deploy instructions, secret-setting commands, curl test snippets

Service role key stays in **database-level GUCs** (`app.service_role_key`, `app.project_url`) — never embedded in trigger source or app bundle.

### Setup guides (deferred to user-controlled steps)
- [docs/EAS-SETUP.md](EAS-SETUP.md) — `eas login` → `eas build:configure` → `eas build --profile preview/production` → `eas submit` workflow. Apple Developer account requirement noted; cost note for paid tiers.
- [docs/PUSH-NOTIFICATIONS-SETUP.md](PUSH-NOTIFICATIONS-SETUP.md) — APNs cert setup, app.json push config, sample trigger SQL using `pg_net` extension to invoke the `send-push-notification` function on inserts to `likes`/`comments`/`watched_with`/`follows`.

### Design system additions
- [components/Toast.tsx](../components/Toast.tsx) + [ToastProvider.tsx](../components/ToastProvider.tsx) — context-backed queue, max 3 visible (oldest dropped hard on burst, no overlap animation chaos), 3500ms default duration, `Animated.spring` slide-in + linear fade-out, safe-area-aware bottom positioning via `useSafeAreaInsets()` with `Math.max(insets.bottom, spacing.lg)` floor. `useToast()` falls back to no-op + `__DEV__` warning when called outside provider (defensive boot-time safety).
- [components/StatNumber.tsx](../components/StatNumber.tsx) — 48px / weight 800 / `tabular-nums` big-number for year-in-review tiles
- [components/InsightSection.tsx](../components/InsightSection.tsx) — micro-typography heading + card-wrapped body for year-in-review composition
- [components/_categoryIcon.ts](../components/_categoryIcon.ts) (NEW — internal, not in barrel) — extracted helper. Maps `'movies'/'games'/'music'/'books'/'tv'` to outline Ionicon names. `RankedItemCard` + `ListItemPreviewCard` swapped to import from it.

### Frontend
- [app/(tabs)/search/books.tsx](../app/(tabs)/search/books.tsx) — full search/rank flow via Google Books `volumes?q=intitle:`
- [app/(tabs)/search/tv.tsx](../app/(tabs)/search/tv.tsx) — full search/rank flow via TMDB `/search/tv`
- [app/(tabs)/search/index.tsx](../app/(tabs)/search/index.tsx) — full rewrite as 2-column grid (5 categories: Movies, TV, Music, Games, Books)
- [app/(tabs)/search/_layout.tsx](../app/(tabs)/search/_layout.tsx) — registered the new routes
- [app/year-in-review.tsx](../app/year-in-review.tsx) — 5 sections (by-the-numbers stat row, top 5 ranked, sentiment breakdown, category breakdown, most-active-month). Empty state when no ranked items in the year.
- [app/profile-delete.tsx](../app/profile-delete.tsx) — destructive flow with **type-your-username-to-enable** UX guard (defensive against accidental taps)
- [app/(tabs)/profile.tsx](../app/(tabs)/profile.tsx) — Year-in-Review purple pill in header
- [app/(tabs)/profile-settings.tsx](../app/(tabs)/profile-settings.tsx) — new "Account" section with "Export my data" (dynamic-require `expo-sharing`+`expo-file-system` first, falls back to in-app modal with copy-to-clipboard) + red "Delete account" link
- [app/(tabs)/recommendations.tsx](../app/(tabs)/recommendations.tsx) — `imageHeightFor` now accepts `string` with `Record<string,number>` lookup (fix for the widened `RecCategory`)
- [app/_layout.tsx](../app/_layout.tsx) — `<ToastProvider>` wraps `<Stack>` inside `<GestureHandlerRootView>`; `setupPush()` effect tied to session via dynamic `require('expo-notifications')` for graceful missing-package handling; new stack screens registered

### Alert.alert → toast swap

Across 5 high-traffic screens, **14 calls converted**:
- `app/(tabs)/lists/create.tsx`: 2 → toast
- `app/list-item/[itemId].tsx`: 5 → toast, 1 kept (destructive delete confirm)
- `app/profile/[username]/index.tsx`: 2 → toast, 1 kept (destructive delete-post confirm)
- `app/(tabs)/profile-settings.tsx`: 4 → toast, 1 kept (web-no-image-picker info dialog)
- `app/post/compose.tsx`: 0 (errors flow through ComposePostInput's own Alert)

Destructive "are you sure?" confirmations correctly stayed as `Alert.alert` per the brief.

### npm dependencies added
- `expo-notifications` — for push token registration + permissions
- `expo-sharing` — for "Export my data" native share sheet
- `expo-clipboard` — for "Copy to clipboard" fallback when share isn't available

Frontend-dev's initial sandbox blocked `npx expo install`; team-lead ran the install in a final pass and verified the build (`1665 modules` web-bundled, up from 1500 at end of Phase 4).

### What still requires manual user action

Three categories of work that can't happen from code:

1. **Apply [docs/PHASE-5-MIGRATION.sql](PHASE-5-MIGRATION.sql)** in Supabase Dashboard
2. **Deploy edge functions** per [docs/edge-functions/README.md](edge-functions/README.md):
   - `supabase functions deploy delete-account`
   - `supabase functions deploy send-push-notification`
   - Set secrets: `supabase secrets set EXPO_ACCESS_TOKEN=...` (for push) — service role is built-in
3. **EAS Build / Push setup** per [docs/EAS-SETUP.md](EAS-SETUP.md) and [docs/PUSH-NOTIFICATIONS-SETUP.md](PUSH-NOTIFICATIONS-SETUP.md) — requires Apple Developer account + Expo account interaction

---

## Final State Snapshot

### Library (`lib/`)
| File | Purpose | First shipped |
|---|---|---|
| `supabase.ts` | Supabase client with SSR-safe storage | Session 0 |
| `ComparisonSheet.tsx` | Binary-comparison UI | Pre-existing |
| `ListContext.tsx` | Active-list context | Pre-existing |
| `queries.ts` | List + item helpers (extended each phase) | Stabilize |
| `photoUpload.ts` | List-item photo upload | Stabilize |
| `apiKeys.ts` | TMDB/RAWG env vars | For You v1 / Phase 1 |
| `recommendations.ts` | TMDB/RAWG/iTunes/Google Books rec engine, 5 categories | For You v1 / extended Phase 5 |
| `recommendationsCache.ts` | 24h AsyncStorage cache | For You v1 |
| `itemDetails.ts` | Per-category detail fetchers, 5 categories | For You v1 / extended Phase 5 |
| `profile.ts` | Profile CRUD + lookup + search | Phase 1 / extended Phase 2 |
| `theme.ts` | Design tokens | Phase 2 |
| `social.ts` | Follow graph | Phase 2 |
| `engagement.ts` | Likes + comments + watched-with | Phase 3 |
| `notifications.ts` | Derived notification feed | Phase 3 |
| `posts.ts` | Post CRUD + per-user feed | Phase 4 |
| `feed.ts` | Unified posts+rankings feed | Phase 4 (amendment) |
| `insights.ts` | Year-in-review stats | Phase 5 |
| `account.ts` | Data export + account deletion | Phase 5 |
| `pushTokens.ts` | Expo push token registration | Phase 5 |

### Components (`components/`) — 28 files
Avatar, Button, CommentBubble, CommentInput, ComposePostInput, EmptyState, EngagementBar, FollowButton, InsightSection, LikeButton, ListItemPreviewCard, LoadingState, NotificationRow, Pill, PostCard, ProfileHeader, RankedItemCard, RelativeTime, StatNumber, StatPill, Toast, ToastProvider, UserRow, UserTagPicker, VisibilitySelector, WatchedWithStack, _categoryIcon (internal), index.ts

### Routes (`app/`)
- `(auth)/login.tsx` + `signup.tsx`
- `(tabs)/index.tsx` (Feed) + `lists/[id]` + `lists/index` + `lists/create` + `search/{movies,games,music,tv,books,index}` + `recommendations.tsx` + `profile.tsx` + `profile-settings.tsx`
- `item/[category]/[externalId].tsx` (external media detail — for You)
- `list-item/[itemId].tsx` (owned-item detail — Phase 3)
- `profile/[username]/{index,followers,following}.tsx`
- `users/search.tsx`
- `notifications.tsx`
- `post/compose.tsx`
- `year-in-review.tsx` (Phase 5)
- `profile-delete.tsx` (Phase 5)

### Documentation (`docs/`)
- `database-schema.md` — initial inferred schema (Session 0)
- `social-schema.md` — full 5-phase social schema design
- `onboarding-flow-todo.md` — deferred onboarding spec
- `agent-teams-reference.md` — Claude Code agent-teams reference
- `PHASE-1-MIGRATION.sql` — list visibility + username unique + public RLS
- `PHASE-2-MIGRATION.sql` — follows table
- `PHASE-3-MIGRATION.sql` — likes + comments + watched_with + notification_last_seen
- `PHASE-4-MIGRATION.sql` — posts table
- `PHASE-5-MIGRATION.sql` — push_tokens table
- `EAS-SETUP.md` — EAS Build / TestFlight walkthrough
- `PUSH-NOTIFICATIONS-SETUP.md` — APNs + push trigger setup
- `edge-functions/delete-account.ts` — Deno source for account deletion
- `edge-functions/send-push-notification.ts` — Deno source for push fanout
- `edge-functions/README.md` — deploy instructions
- `CHANGELOG.md` — this document

---

## Manual Steps Required (Consolidated)

Apply in this order in the Supabase Dashboard → SQL Editor:

1. **Storage buckets**: ensure `avatars` and `list-item-photos` exist (Storage → New bucket → Public: ON)
2. **`docs/PHASE-1-MIGRATION.sql`** — list visibility, username unique, public RLS
3. **`docs/PHASE-2-MIGRATION.sql`** — follows table
4. **`docs/PHASE-3-MIGRATION.sql`** — likes/comments/watched-with + notification timestamp
5. **`docs/PHASE-4-MIGRATION.sql`** — posts table (depends on Phase 2's `follows`)
6. **`docs/PHASE-5-MIGRATION.sql`** — push_tokens (independent of prior phases)

Every migration file is idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` etc.) with per-block verification SELECTs and a commented-out rollback section.

### Edge functions (Phase 5)

Deploy from `docs/edge-functions/` via:
```
supabase functions deploy delete-account
supabase functions deploy send-push-notification
supabase secrets set EXPO_ACCESS_TOKEN=<your Expo access token>
```

See [docs/edge-functions/README.md](edge-functions/README.md) for full instructions.

### EAS + Push setup (Phase 5)

- [docs/EAS-SETUP.md](EAS-SETUP.md) — `eas login` → `eas build:configure` → `eas build` → `eas submit`. Requires Apple Developer + Expo account.
- [docs/PUSH-NOTIFICATIONS-SETUP.md](PUSH-NOTIFICATIONS-SETUP.md) — APNs cert setup + database triggers for fanout.

Environment variables:
- `.env` must exist at project root with `EXPO_PUBLIC_TMDB_API_KEY` and `EXPO_PUBLIC_RAWG_API_KEY` set

---

## Known Tech Debt / Deferred Items

| Item | Status | Where |
|---|---|---|
| Onboarding flow (signup → username → bio → tutorial first-rank) | Spec written | [docs/onboarding-flow-todo.md](onboarding-flow-todo.md) |
| Existing edit-sheet code in `app/(tabs)/lists/[id].tsx` (~150 LOC) | Unreachable but preserved | Recommend: move into modal in list-item detail and strip |
| "Edit in list" two-step path on list-item detail | UX clunkiness | Either inline editor or `?openEdit=true` query param |
| Cursor pagination edge case in `getFeedPosts` / `getFeed` | Millisecond-collision possible but vanishingly rare | Composite cursor with `id` if it ever bites |
| Posts UPDATE / edit support | Deferred to future phase | Will need `edited_at` column + UPDATE RLS policy |
| Custom genre/artist recommendation algorithm | Deferred | Would replace/augment API-driven recs once user data scales |
| Profile-page Posts section showing rankings too (parity with home feed) | Deferred | Currently only shows actual posts |
| Phase 5: new media types (books, TV), year-in-review, account deletion, error toasts, EAS/TestFlight, push notifications | Roadmap planned | Ready when user wants |

---

## Team Workflow Notes

Across all phases the same standing `rankr-foryou-v2` agent team handled the work. Three Sonnet specialists:

- **backend-dev** — Supabase/SQL/data layer (`lib/*.ts` excluding theme, `docs/*.sql`, `docs/*.md`)
- **ui-ux-dev** — design system (`lib/theme.ts`, `components/*.tsx`)
- **frontend-dev** — screens + navigation (`app/**/*.tsx`, `lib/ComparisonSheet.tsx`)

Strict file ownership boundaries with explicit "off-limits" lists in every spawn prompt. Cross-team handoffs via the team lead (this conversation) since async sub-agents don't get peer SendMessage tools.

Key coordination patterns that emerged:
1. **Stub-then-swap** (Phase 3 onward): frontend-dev scaffolds against named-but-not-yet-existing imports as stubs, gets `tsc` green, then reads canonical files from disk and swaps in real imports. Single agent turn — no separate reconciliation pass.
2. **Two-step profile join** (Phase 3 + Phase 4 amendment): when reaching `profiles` from indirect FK chains, fetch the rows first and then batch profiles by `IN (...)` rather than gambling on PostgREST FK auto-discovery.
3. **Per-phase verification gate**: `npx tsc --noEmit` exit 0 + `CI=1 npx expo start --web` bundles clean. Every phase ended green.

Every phase started clean and ended clean. No regressions across 4 phases of social-app work on top of the original Rankr stabilization.
