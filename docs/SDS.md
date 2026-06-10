# Software Design Specifications Document

**Rankr**
**Team 1**
**Zavian De Leon**

**Software Design Specification & Project Delivery Report**

Version: 1.0
Date: 06/09/2026

---

## Table of Contents

1. [Introduction](#1-introduction)
   - 1.1 [Goals and objectives](#11-goals-and-objectives)
   - 1.2 [Statement of system scope](#12-statement-of-system-scope)
   - 1.3 [Reference Material](#13-reference-material)
   - 1.4 [Definitions and Acronyms](#14-definitions-and-acronyms)
2. [Architectural design](#2-architectural-design)
   - 2.1 [System Architecture](#21-system-architecture)
   - 2.2 [Design Rationale](#22-design-rationale)
3. [Key Functionality design](#3-key-functionality-design)
   - 3.1 [Binary Comparison Ranking Engine](#31-binary-comparison-ranking-engine)
   - 3.2 [Search and External Catalog Integration](#32-search-and-external-catalog-integration)
   - 3.3 [Social Feed and Engagement System](#33-social-feed-and-engagement-system)
4. [User interface design](#4-user-interface-design)
   - 4.1 [Interface design rules](#41-interface-design-rules)
   - 4.2 [Description of the user interface](#42-description-of-the-user-interface)
5. [Restrictions, limitations, and constraints](#5-restrictions-limitations-and-constraints)
6. [Testing Issues (SLO #2.v)](#6-testing-issues-slo-2v)
   - 6.1 [Types of tests](#61-types-of-tests)
   - 6.2 [List of Test Cases](#62-list-of-test-cases)
   - 6.3 [Test Coverage](#63-test-coverage)
7. [Appendices](#7-appendices)
   - 7.1 [Installation](#71-installation)
   - 7.2 [User Manual](#72-user-manual)
   - 7.3 [Open Issues](#73-open-issues)
   - 7.4.1 [Project Management & Task Allocations (SLO #2.i)](#741-project-management--task-allocations-slo-2i)
   - 7.4.2 [Implementation (SLO #2.iv)](#742-implementation-slo-2iv)
   - 7.4.3 [Design Patterns](#743-design-patterns)
   - 7.4.4 [Team Communications](#744-team-communications)
   - 7.4.4 [Technologies Practiced (SLO #7)](#7445-technologies-practiced-slo-7)
   - 7.4.5 [Desirable Changes](#7446-desirable-changes)
   - 7.4.6 [Challenges Faced](#7447-challenges-faced)

---

## 1 Introduction

This section provides an overview of the entire design document. This document describes all data, architectural, interface, and component-level design for the Rankr software.

### 1.1 Goals and objectives

The primary goal of this project is to develop a cross-platform social ranking application that lets users build personal ranked lists of media (movies, TV shows, music, video games, and books) through head-to-head comparisons rather than by manually ordering items. The key objectives include a working binary comparison algorithm that produces a numeric score in the range 1–10, a full social layer with follows, posts, comments, likes, and notifications, integration with external catalog APIs for media metadata, and a polished mobile-first experience that also runs on the web. The system should be stable, performant on modest hardware, and modular enough that new media categories or social features can be added without rewriting the core ranking engine.

### 1.2 Statement of system scope

The system is a self-contained client/server application. The client is built with [Expo](https://expo.dev) (React Native + TypeScript) using [expo-router](https://docs.expo.dev/router/introduction/) for file-based navigation, and ships to iOS, Android, and the web from a single codebase. The backend is hosted on [Supabase](https://supabase.com): Postgres for relational data, Supabase Auth for identity (email/password plus Google and Apple OAuth), Supabase Storage for user-uploaded avatars and item photos, and Supabase Edge Functions for privileged operations such as account deletion and push delivery.

The scope encompasses authentication and onboarding, list creation across multiple media categories, search against external metadata providers (TMDB, RAWG, iTunes, Open Library, Google Books), the head-to-head ranking flow, a public profile and social graph, a notifications inbox, push notifications via Expo, a "For You" recommendations surface, and a year-in-review screen. The system is modular: the ranking engine, search adapters, social subsystem, and recommendations cache are each developed independently and communicate through narrow typed interfaces in [lib/](../lib).

---

### Use Case Overview

```
┌──────────────────────────────────────────────┐
│  Unauthenticated                             │
│   ─ Sign up / Log in (email or OAuth)        │
│   ─ View landing                             │
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│  Onboarding                                  │
│   ─ Create profile (username, display name)  │
│   ─ First rank (seed initial list)           │
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│  Authenticated — Tabs                        │
│   ─ Home feed (recent activity)              │
│   ─ Lists (create, view, edit, delete)       │
│       └─ Compare items head-to-head          │
│   ─ Search (TMDB, RAWG, iTunes, Books)       │
│       └─ Add to list → trigger comparison    │
│   ─ For You (recommendations)                │
│   ─ Profile (own + others, follow/unfollow)  │
│       └─ Year in Review                      │
│       └─ Notifications inbox                 │
│       └─ Settings (account, delete account)  │
└──────────────────────────────────────────────┘
```

### 1.3 Reference Material

- Expo Router documentation: https://docs.expo.dev/router/introduction/
- React Native: https://reactnative.dev/docs/getting-started
- Supabase JavaScript client: https://supabase.com/docs/reference/javascript/introduction
- Supabase Row Level Security: https://supabase.com/docs/guides/auth/row-level-security
- The Movie Database (TMDB) API: https://developer.themoviedb.org/docs
- RAWG Video Games Database API: https://api.rawg.io/docs/
- iTunes Search API: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
- Google Books API: https://developers.google.com/books/docs/v1/using
- Open Library API: https://openlibrary.org/developers/api
- Expo Notifications: https://docs.expo.dev/versions/latest/sdk/notifications/
- React Native Reanimated: https://docs.swmansion.com/react-native-reanimated/

### 1.4 Definitions and Acronyms

- **RN (React Native):** the framework used to render native mobile UI from JavaScript/TypeScript.
- **Expo:** the toolchain on top of React Native that handles build, OTA updates, and native APIs.
- **RLS (Row Level Security):** Postgres feature used by Supabase to enforce per-user access on the database side.
- **OAuth:** delegated authentication; Rankr supports Google and Apple as providers.
- **TMDB / RAWG / iTunes:** external metadata APIs queried for movies/TV, games, and music respectively.
- **Edge Function:** a Deno function deployed to Supabase that runs with elevated privileges.
- **Ranked item:** a `list_items` row with a non-null `rank` value in the range ~1–10.5.
- **Bookmarked item:** a `list_items` row with `bookmarked = true`, saved for later, not yet ranked.
- **Sentiment:** one of `liked`, `didnt_care`, or `didnt_like`; chosen by the user when adding an item; used to bucket items before the binary comparison runs.
- **Binary comparison:** the core ranking mechanism — two items are shown side by side and the user picks the one they prefer.

---

## 2 Architectural design

### 2.1 System Architecture

Rankr uses a layered client/server architecture. The Expo client is structured along Model–View–Controller lines, with [`lib/`](../lib) serving as the model and data-access layer, [`components/`](../components) as reusable view primitives, and [`app/`](../app) as the controller — screen-level components that wire user input to data operations and navigate via expo-router.

```
┌──────────────────────────────────────────────────────────────┐
│                      Expo Client (View)                      │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │ app/(tabs)/      │  │ components/      │                  │
│  │  - index         │  │  - PostCard      │                  │
│  │  - lists/[id]    │  │  - RankedItem    │                  │
│  │  - search/*      │  │  - ComparisonSht │                  │
│  │  - recommendations│ │  - Avatar/Button │                  │
│  │  - profile       │  │  - ToastProvider │                  │
│  └────────┬─────────┘  └────────┬─────────┘                  │
│           │                     │                            │
│           ▼                     ▼                            │
│  ┌────────────────────────────────────────────┐              │
│  │              lib/ (Controller / Model)     │              │
│  │  supabase  queries  posts   feed           │              │
│  │  social    profile  insights  notifications│              │
│  │  recommendations / cache  itemDetails      │              │
│  │  theme     a11y     responsive             │              │
│  └────────┬──────────────────────────┬────────┘              │
└───────────│──────────────────────────│───────────────────────┘
            │                          │
            ▼                          ▼
┌──────────────────────┐    ┌────────────────────────────────┐
│   Supabase Backend   │    │  External Metadata APIs        │
│  ─ Postgres + RLS    │    │  ─ TMDB     (movies / TV)      │
│  ─ Auth (email,      │    │  ─ RAWG     (games)            │
│    Google, Apple)    │    │  ─ iTunes   (music)            │
│  ─ Storage (avatars, │    │  ─ Open Library /              │
│    item photos)      │    │    Google Books                │
│  ─ Edge Functions    │    └────────────────────────────────┘
│    (delete-account,  │
│    send-push)        │
└──────────────────────┘
```

The Postgres schema (defined in [docs/database-schema.md](database-schema.md)) is the single source of truth. Public read access for social entities (`lists`, `list_items`, `posts`, `comments`, `likes`, `follows`) is governed by RLS so that the same query that loads a user's own profile can also load a stranger's, with the database enforcing what each viewer is allowed to see. Authenticated write paths are scoped to `auth.uid()`, removing the need for the client to enforce ownership in code.

### 2.2 Design Rationale

The MVC-style split between [app/](../app), [components/](../components), and [lib/](../lib) was chosen because expo-router naturally pushes routing and screen orchestration into `app/`, leaving `lib/` free to hold the pure data layer. Keeping every Supabase call funneled through small helpers in `lib/` (rather than scattered across screens) means the schema, query optimizations, and RLS expectations live in one place — when a query needs to change from N+1 to a nested select (see `fetchRecentItemsWithListTitles` in [lib/queries.ts](../lib/queries.ts)), only the helper changes, not every screen that uses it.

Supabase was chosen over a custom Node/Express backend because Postgres + RLS provides authoritative, server-side authorization without the team having to ship and operate a separate API service. This is consistent with the project's solo-dev scope.

---

## 3 Key Functionality design

### 3.1 Binary Comparison Ranking Engine

#### 3.1.1 Use cases

The user adds a new item to a list (via search, or manually). They pick an initial sentiment — *liked*, *didn't care*, or *didn't like* — which seeds the item into a sentiment bucket. The ranking engine then surfaces an existing ranked item from the same bucket and presents a head-to-head matchup through the `ComparisonSheet` component. The user taps the item they prefer. The engine bisects the bucket based on that choice and presents another matchup, narrowing the new item's position with each comparison (binary-search style). After log₂(n) comparisons the new item is assigned a numeric score in the 1–10 range, and the ranked list re-renders in score order. The user can dismiss the comparison flow at any time and resume later — bookmarked-but-unranked items live in the same `list_items` table with `rank = null` and `bookmarked = false` (for "pending placement").

#### 3.1.2 Processing sequence for the ranking engine

When an item is added, the client first writes a `list_items` row with `rank = null` and the chosen sentiment. The comparison pool is then loaded: a single Supabase query selects all items in the same list with non-null rank, ordered by rank descending. The engine maintains a `[lo, hi]` index range over that pool. Each iteration it picks the midpoint, hands `(newItem, pool[mid])` to the `ComparisonSheet`, and waits for `onChooseNew` or `onChooseExisting`. The result narrows the range. When `lo === hi`, the engine computes a final rank by interpolating between the neighboring items' scores (or clamping to the bucket's score window for the *liked* / *didn't care* / *didn't like* sentiments) and writes the result with a single `update({ rank }).eq('id', ...)` call.

#### 3.1.3 Structural design for the ranking engine

The engine is built from three units:

- [`lib/ListContext.tsx`](../lib/ListContext.tsx) — React context that holds the active list state, the comparison pool, and the iteration index range. Exposes `enqueueComparison`, `chooseNew`, `chooseExisting`, and `cancelComparison`.
- [`lib/ComparisonSheet.tsx`](../lib/ComparisonSheet.tsx) — animated modal that renders the two-card head-to-head UI and forwards taps to the context. Pure view — no Supabase access.
- [`lib/queries.ts`](../lib/queries.ts) — the data-layer helpers that load the comparison pool and persist the resulting rank.

This split keeps the algorithm independent of the rendering: the same engine drives the iOS, Android, and web experiences without branching on platform.

#### 3.1.4 Key Activities

```
┌─────────────┐
│ Item added  │
│ (search /   │
│  manual)    │──► sentiment chosen ──► insert row (rank = null)
└──────┬──────┘
       ▼
┌───────────────────┐     pool empty?
│ Load comparison   │──── yes ──► assign score from sentiment bucket
│ pool (same list,  │              and exit
│ rank != null)     │
└──────┬────────────┘
       │ pool non-empty
       ▼
┌───────────────────┐
│ lo = 0, hi = N-1  │◄────────────────────────┐
└──────┬────────────┘                         │
       ▼                                      │
┌───────────────────┐    user picks new ──► hi = mid - 1
│ Show midpoint vs  │    user picks       ──► lo = mid + 1
│ new item          │      existing          │
└──────┬────────────┘                         │
       │                                      │
       │      lo <= hi ───────────────────────┘
       │
       │ lo > hi
       ▼
┌───────────────────┐
│ Interpolate rank, │
│ update row,       │
│ refresh list view │
└───────────────────┘
```

#### 3.1.5 Software Interface to other components

The ranking engine talks to Supabase via [lib/queries.ts](../lib/queries.ts) for reads and writes on `list_items`. It is invoked from screens — most prominently [app/(tabs)/lists/[id].tsx](../app/(tabs)/lists/[id].tsx) and the search result handlers in [app/(tabs)/search/](../app/(tabs)/search) — through the `ListContext` provider mounted at the tab layout root. When a rank settles, the engine emits an event consumed by the home feed and "For You" caches so they invalidate stale snapshots. It does not call any external API; metadata comes attached to the item at insertion time.

---

### 3.2 Search and External Catalog Integration

#### 3.2.1 Use cases

The user opens the Search tab and chooses a category (movies, TV, music, games, books). They type a query; results from the appropriate external API stream in as cards. Tapping a result either adds the item directly to a target list (if the user has a single matching list) or opens a picker. On add, the search flow seeds sentiment and hands control to the binary comparison engine described in §3.1.

#### 3.2.2 Processing sequence for search

Each keystroke is debounced (~300 ms) inside the per-category screen — [`movies.tsx`](../app/(tabs)/search/movies.tsx), [`tv.tsx`](../app/(tabs)/search/tv.tsx), [`music.tsx`](../app/(tabs)/search/music.tsx), [`games.tsx`](../app/(tabs)/search/games.tsx), [`books.tsx`](../app/(tabs)/search/books.tsx). When the debounce fires, the screen calls the relevant fetcher in [lib/itemDetails.ts](../lib/itemDetails.ts), which normalizes the external API's response shape into a uniform `{ title, subtitle, image_url, external_id, category }` envelope. Books search prefers Open Library by default and transparently falls back to Google Books when an API key is configured. Duplicate detection is performed via `select('id').eq('list_id', ...).eq('external_id', ...).single()` before the insert.

#### 3.2.3 Structural Design for search

```
┌────────────────────┐
│ search/*.tsx       │  per-category screens
│  (movies, tv,      │
│   music, games,    │
│   books)           │
└─────────┬──────────┘
          │  debounced query
          ▼
┌────────────────────┐        ┌───────────────────┐
│ lib/itemDetails.ts │───────►│ External APIs:    │
│  - fetchMovies     │        │  TMDB, RAWG,      │
│  - fetchTv         │        │  iTunes,          │
│  - fetchMusic      │        │  Open Library /   │
│  - fetchGames      │        │  Google Books     │
│  - fetchBooks      │        └───────────────────┘
└─────────┬──────────┘
          │  normalized result
          ▼
┌────────────────────┐
│ Add-to-list picker │──►  insert into list_items  ──►  ranking engine
└────────────────────┘
```

#### 3.2.4 Key Activities

The search subsystem retrieves remote metadata, normalizes it across five different API shapes into one local type, deduplicates against the user's existing items, and hands the item off to the ranking engine. API keys for TMDB/RAWG/iTunes/Google Books are read from `expo-constants` extra at runtime via [lib/apiKeys.ts](../lib/apiKeys.ts).

#### 3.2.5 Software Interface to other components

Search outputs feed directly into the ranking engine (§3.1) and indirectly into the social feed when an item is later promoted to a `posts` row. Search does not touch the social tables or the recommendations cache.

---

### 3.3 Social Feed and Engagement System

#### 3.3.1 Use cases

A user can follow other users, post text/images, react to posts via likes, comment on posts, mention other users with `@username` tags, and receive notifications for each of those events. The home tab surfaces a chronological feed assembled from posts by followed users and the user's own activity. Notifications are grouped — for example, "Alice, Bob, and 3 others liked your post" — and tapping one deep-links to the relevant post or list.

#### 3.3.2 Processing Sequence

Posts are written through [lib/posts.ts](../lib/posts.ts), which inserts a row into `posts` and, on success, fans out follower-targeted notifications via [lib/notifications.ts](../lib/notifications.ts). Likes go through [lib/engagement.ts](../lib/engagement.ts) using an idempotent upsert keyed on `(post_id, user_id)`. The home feed loader in [lib/feed.ts](../lib/feed.ts) issues a single nested select that joins `posts` to author profiles and aggregated like/comment counts, then merges in the recent-items query from [lib/queries.ts](../lib/queries.ts). Push delivery is handled server-side by the `send-push-notification` Edge Function, which reads recipient push tokens from `push_tokens` and calls Expo's push service.

#### 3.3.3 Structural Design

Key types live alongside their helpers:

- [`lib/feed.ts`](../lib/feed.ts) — composes the home timeline.
- [`lib/posts.ts`](../lib/posts.ts) — CRUD on `posts`, mention extraction.
- [`lib/social.ts`](../lib/social.ts) — follows / unfollows, follower counts.
- [`lib/engagement.ts`](../lib/engagement.ts) — likes, comment add/remove.
- [`lib/notifications.ts`](../lib/notifications.ts) — write + read inbox; grouping logic.
- [`lib/pushTokens.ts`](../lib/pushTokens.ts) — register the device's Expo push token.
- [`supabase/functions/send-push-notification`](../supabase/functions/send-push-notification) — server-side delivery.

Components — [`PostCard`](../components/PostCard.tsx), [`CommentBubble`](../components/CommentBubble.tsx), [`LikeButton`](../components/LikeButton.tsx), [`FollowButton`](../components/FollowButton.tsx), [`NotificationRow`](../components/NotificationRow.tsx), [`UserTagPicker`](../components/UserTagPicker.tsx) — render the feed without making Supabase calls of their own.

#### 3.3.4 Key Activities

```
       ┌────────────────────┐
       │ User writes post   │
       └────────┬───────────┘
                ▼
   ┌─────────────────────────┐
   │ insert posts row        │
   │ extract @mentions       │
   └────────┬────────────────┘
            ▼
   ┌─────────────────────────┐      ┌────────────────────────┐
   │ enqueue notifications   │─────►│ send-push Edge Fn      │
   │ (followers + mentions)  │      │ → Expo push service    │
   └────────┬────────────────┘      └────────────────────────┘
            ▼
   ┌─────────────────────────┐
   │ home feed refresh on    │
   │ next pull / focus       │
   └─────────────────────────┘
```

#### 3.3.5 Software Interface to other components

The social subsystem reads from the same `profiles` and `lists` tables consumed by the rest of the app, so a user's recent rank affecting a list is naturally surfaced in the feed without a separate event bus. Notifications respect RLS: a recipient can only read their own row in `notifications`.

---

## 4 User interface design

### 4.1 Interface design rules

The interface targets a dark, minimal aesthetic with purple as the accent color (see [lib/theme.ts](../lib/theme.ts)). Touch targets are sized at least 44×44 pt to meet iOS HIG. Motion respects the `prefers-reduced-motion` accessibility setting via [lib/a11y.ts](../lib/a11y.ts) — animated components like `ComparisonSheet` and `FadeSlideIn` snap to their final state instead of animating when the user has enabled reduced motion. The same component tree renders to native (iOS/Android) and web (via react-native-web) without UI branching except where Expo Router provides explicit `.web.tsx` overrides for the tabs root.

### 4.2 Description of the user interface

The application is organized around five tabs once the user is authenticated: Home, Lists, Search (centered FAB-style button), For You, and Profile. Unauthenticated users see the landing screen and the auth stack. New users enter the onboarding stack and complete two steps: create profile, and first rank.

#### 4.2.1 Landing & Auth

The landing screen pitches the app and links to sign-up and log-in. Sign-up accepts email/password or OAuth (Google, Apple). Passwords are validated against industry-standard rules (length + character classes) before submission. Username is validated against a regex and checked for uniqueness server-side.

#### 4.2.2 Onboarding

After first auth, the user is routed through `(onboarding)/create-profile` (set username, display name, avatar) and `(onboarding)/first-rank` (seed an initial ranked item so the rest of the app has something to show). The router refuses to leave the onboarding group until both steps complete.

#### 4.2.3 Home tab

A vertically scrolling feed composed of recent ranked items (from the user and followed users) and posts. Each item card shows the title, parent list, image, and current rank pill.

#### 4.2.4 Lists tab

Lists index shows all of the current user's lists. Tapping one opens [`lists/[id].tsx`](../app/(tabs)/lists/%5Bid%5D.tsx) — a draggable, reorderable view of the ranked items with a separate bookmarked section. The screen includes a search-within-list input. Creating a new list flows through `lists/create.tsx`.

#### 4.2.5 Search tab

A category picker leads into per-category search screens (movies, TV, music, games, books). Results are flat cards; a tap initiates the add-to-list + comparison flow described in §3.1 and §3.2.

#### 4.2.6 For You tab

Renders recommendations from [lib/recommendations.ts](../lib/recommendations.ts), backed by [lib/recommendationsCache.ts](../lib/recommendationsCache.ts) so the screen is paint-immediate on subsequent visits and refreshes silently in the background.

#### 4.2.7 Profile tab

Shows the user's profile header (avatar, display name, bio, follower/following counts), their public lists, and a stats section powered by [lib/insights.ts](../lib/insights.ts) and the [`StatPill`](../components/StatPill.tsx) / [`InsightSection`](../components/InsightSection.tsx) components. From the profile, the user can enter Settings, the Year in Review screen, or the Notifications inbox. Visiting another user's profile (`app/users/[id]`) shows the same layout with a `FollowButton`.

---

## 5 Restrictions, limitations, and constraints

- Built on Expo SDK 54 and React Native 0.81.
- Single Postgres instance hosted on Supabase; no horizontal sharding is in scope.
- External APIs (TMDB, RAWG, iTunes, Google Books, Open Library) are rate-limited; the client uses debouncing and result caching rather than a server-side proxy.
- All authorization is enforced server-side via Postgres Row Level Security. Client code must never assume `auth.uid()` checks happen on the client.
- The web build is rendered with `react-native-web` and must avoid touching `window` or `localStorage` at module top-level for SSR compatibility (see `lib/supabase.ts`).
- Push notifications are delivered through Expo's push service; the project does not implement APNs/FCM directly.
- Photo uploads are written to Supabase Storage; storing only `file://` local paths in `list_items.photo_urls` is a known data-correctness issue.

---

## 6 Testing Issues (SLO #2.v)

Test strategy and preliminary test case specification are presented in this section.

### 6.1 Types of tests

1. **Functional Test** — Each user-visible flow (sign-up, create list, add item, compare, like a post, follow a user) behaves as designed.
2. **Authorization Test** — RLS denies access to rows the viewer should not see; "My Lists" queries are scoped to `auth.uid()`.
3. **Algorithmic Test** — The binary comparison engine converges in log₂(n) comparisons and produces scores in the 1–10 range, monotonic with the user's choices.
4. **UI / Accessibility Test** — Touch targets meet minimum size; reduced-motion users see static frames; focus order on web is sensible.
5. **Performance Test** — Home feed and list detail screens paint within 500 ms with a warm cache and remain interactive while loading.
6. **Cross-platform Test** — The same feature works on iOS, Android, and web without divergent behavior.

### 6.2 List of Test Cases

| Test Type            | Authorization Test                                                  |
|----------------------|----------------------------------------------------------------------|
| Testing range        | "My Lists" query scoping                                             |
| Testing Input        | User A logs in; queries lists                                        |
| Testing procedure    | Run lists index → verify only User A's `lists.user_id` rows return   |
| Expected Test Result | No other users' lists returned                                       |
| Tester               | Zavian                                                               |
| Test result          | Passed (HOTFIX-3 added explicit `eq('user_id', user.id)` scope)      |

| Test Type            | Algorithmic Test                                                     |
|----------------------|----------------------------------------------------------------------|
| Testing range        | Binary comparison engine                                             |
| Testing Input        | List with 16 ranked items; insert new item with `liked` sentiment    |
| Testing procedure    | Drive the engine through user choices; count comparisons             |
| Expected Test Result | ≤ 5 comparisons (⌈log₂(16+1)⌉); final rank lies in *liked* bucket    |
| Tester               | Zavian                                                               |
| Test result          | Passed                                                               |

| Test Type            | Functional Test                                                      |
|----------------------|----------------------------------------------------------------------|
| Testing range        | Search → add → compare round trip                                    |
| Testing Input        | Search "Inception" in movies → add → choose sentiment → compare      |
| Testing procedure    | Walk the flow end-to-end; verify final list state                    |
| Expected Test Result | New row in `list_items` with non-null rank and correct `external_id` |
| Tester               | Zavian                                                               |
| Test result          | Passed                                                               |

| Test Type            | UI / Accessibility Test                                              |
|----------------------|----------------------------------------------------------------------|
| Testing range        | ComparisonSheet animation                                            |
| Testing Input        | Enable "Reduce Motion" in OS settings; trigger a comparison          |
| Testing procedure    | Observe sheet entry                                                  |
| Expected Test Result | Sheet appears at final position with no scale/opacity animation       |
| Tester               | Zavian                                                               |
| Test result          | Passed                                                               |

| Test Type            | Cross-platform Test                                                  |
|----------------------|----------------------------------------------------------------------|
| Testing range        | Web SSR / hydration                                                  |
| Testing Input        | Build via `expo export -p web` and serve                             |
| Testing procedure    | Visit landing, log in, navigate to home                              |
| Expected Test Result | No `window is not defined` errors; auth session persists across reload |
| Tester               | Zavian                                                               |
| Test result          | Passed                                                               |

| Test Type            | Functional Test                                                      |
|----------------------|----------------------------------------------------------------------|
| Testing range        | Push notifications                                                   |
| Testing Input        | User A is followed by User B; User A posts                           |
| Testing procedure    | Verify `send-push-notification` is invoked and B's device receives   |
| Expected Test Result | Push received with deep link to A's post                             |
| Tester               | Zavian                                                               |
| Test result          | Passed                                                               |

### 6.3 Test Coverage

All major functional requirements were implemented and tested, with the core flows — sign-up/log-in, create list, add item, head-to-head compare, post / like / comment, follow, notifications — exercised manually on iOS, Android, and web. Non-functional requirements such as maintainability, modularity, accessibility, and cross-platform parity were upheld throughout development. An early version of the home screen suffered an N+1 fetch problem (load items, then load each parent list's title individually); this was resolved by introducing `fetchRecentItemsWithListTitles` in [lib/queries.ts](../lib/queries.ts), which collapses the fetch into a single nested select.

Functional requirements include: the binary comparison ranking engine, multi-category search, social posting/likes/comments, follow graph, notifications inbox with grouping, push notification delivery, profile + onboarding, OAuth sign-in (Google and Apple), account deletion, and a Year in Review surface. The ranking engine is fully achieved and converges within log₂(n) comparisons. Social features are fully achieved. Push notifications are achieved end-to-end (Edge Function deployed). Recommendations are achieved with caching. One known partial: `list_items.photo_urls` still stores `file://` paths in some legacy rows — the upload path now routes through Supabase Storage but a migration to backfill old rows is outstanding.

---

## 7 Appendices

### 7.1 Installation

Project GitHub: https://github.com/z4vian/RankrApp

1. Install Node.js (≥ 20) and the Expo CLI.
2. Clone the repository and `cd` into it.
3. `npm install`.
4. Provision a Supabase project; copy `SUPABASE_URL` and `SUPABASE_ANON_KEY` into `app.json`'s `extra` block, along with API keys for TMDB / RAWG / iTunes / Google Books (optional).
5. Apply the SQL migrations in [docs/PHASE-1-MIGRATION.sql](PHASE-1-MIGRATION.sql) through [docs/PHASE-7-MIGRATION.sql](PHASE-7-MIGRATION.sql) plus the HOTFIX scripts.
6. `npx expo start` — scan the QR code with Expo Go, or press `i` / `a` / `w` for iOS simulator / Android emulator / web.

### 7.2 User Manual

- **Sign up**: enter email + password, or use *Continue with Google* / *Continue with Apple*.
- **Create a list**: tap Lists → +, pick a category, name it.
- **Add items**: tap the Search tab (center button), choose category, search, tap a result, choose sentiment.
- **Rank**: when a comparison sheet appears, tap the item you prefer. Repeat until the sheet closes.
- **Reorder manually**: open a list and long-press an item to drag.
- **Follow someone**: open their profile from the feed or search and tap *Follow*.
- **Notifications**: tap the bell icon on the profile tab.
- **Year in Review**: accessible from the profile tab.

### 7.3 Open Issues

- Backfill `list_items.photo_urls` from `file://` to Supabase Storage URLs.
- Add server-side dedupe for notifications that arrive in rapid succession.
- Tighten Edge Function rate limits.
- Add a recommendations feedback loop (thumbs up/down) to improve the For You ranking.

### 7.4.1 Project Management & Task Allocations (SLO #2.i)

This project was developed solo. Task allocation was therefore self-directed — the work was sequenced by phase (auth → lists → ranking → search → social → notifications → recommendations → polish), each captured as a numbered migration script in [docs/](.). Project planning was done in-conversation with AI tooling (Claude, ChatGPT) at the start of each phase to surface schema decisions, RLS rules, and component boundaries before code was written. Risk analysis focused mostly on the data model — getting the `list_items` schema and RLS right early avoided expensive rewrites later; the hotfix scripts in [docs/HOTFIX-*.sql](.) capture the cases that were not caught up front (foreign keys on profile signup, profile-signup RLS, and write-scoping for the lists table). Progress was tracked via git commits with conventional prefixes (`feat:`, `fix:`, `docs:`).

### 7.4.2 Implementation (SLO #2.iv)

Code review was self-driven, primarily through git history and visual diffing before each commit. The largest refactor was the home-screen N+1 → nested-select migration described in §6.3. A second meaningful refactor was the consolidation of the social helpers into separate files in `lib/` (originally a single `social.ts`, then split into `social.ts` + `feed.ts` + `engagement.ts` + `notifications.ts` as responsibilities crystallized). The final implementation matches the design outlined in §2: MVC-style separation, all backend interactions funneled through `lib/`, and a strict policy of pushing authorization into Postgres RLS rather than client checks.

### 7.4.3 Design Patterns

A Model–View–Controller layout was chosen because Expo Router naturally splits routing from rendering, and a thin `lib/` data layer is a clean fit for the Model role. A **Strategy** pattern is used across the per-category search adapters in [lib/itemDetails.ts](../lib/itemDetails.ts): all return the same envelope shape so callers don't care which API answered. A **Repository**-style pattern in [lib/queries.ts](../lib/queries.ts) keeps Supabase query construction out of screens. The ranking engine uses a **State** pattern over a small set of states (idle → comparing → settling) managed by the `ListContext` reducer. **Facade** patterns appear in [lib/feed.ts](../lib/feed.ts) and [lib/recommendations.ts](../lib/recommendations.ts), each presenting a single typed entry point on top of multiple underlying queries.

### 7.4.4 Team Communications

Built solo, so team communication was minimal; planning happened in conversations with AI tooling and was captured in commit messages. Improvement for future work: keep a CHANGELOG (one exists at [docs/CHANGELOG.md](CHANGELOG.md) but is not consistently updated).

### 7.4.5 Technologies Practiced (SLO #7)

This project provided first-hand experience with: Expo and React Native (including the difference between `react-native` and `react-native-web` builds), TypeScript at scale across ~30 lib modules, Supabase Postgres with Row Level Security, Supabase Edge Functions running on Deno, Expo push notifications, OAuth integration for Google and Apple via `expo-auth-session`, Vercel deployment for the web build, and image upload pipelines through Supabase Storage. Designing and tuning the binary comparison algorithm was the largest single new skill.

### 7.4.6 Desirable Changes

With another month, the priorities would be: (1) ship the photo-URL backfill so older list items survive reinstall, (2) introduce a thumbs-up/thumbs-down feedback loop in the For You tab to make recommendations adaptive, (3) add a comment thread view (replies-to-replies) rather than the current flat list, (4) build a public web profile renderable without an account so links can be shared in DMs, and (5) write a small suite of Detox or Maestro end-to-end tests to guard the sign-up → first-rank → home flow.

### 7.4.7 Challenges Faced

The hardest task was **system design** — specifically the data model. RLS forced authorization decisions to be made at the schema level, which meant getting `user_id`, foreign keys, and the public/private split right *before* writing UI. Several hotfix migrations (in [docs/HOTFIX-1-PROFILE-FKS.sql](HOTFIX-1-PROFILE-FKS.sql), [docs/HOTFIX-2-PROFILE-SIGNUP-RLS.sql](HOTFIX-2-PROFILE-SIGNUP-RLS.sql), [docs/HOTFIX-3-LISTS-WRITE-RLS.sql](HOTFIX-3-LISTS-WRITE-RLS.sql)) document cases that were not designed correctly on the first pass and had to be patched without losing user data. Implementation challenges (cross-platform parity between iOS / Android / web, animation glitches, push-token registration) were time-consuming but tractable. Requirements specification was straightforward because the product brief — head-to-head ranking with a social layer — was clear from the start.
