# Rankr — Social Schema Design (Phases 1–4)

> **Status**: Design document. Only Phase 1 is being **applied** today (see
> `docs/PHASE-1-MIGRATION.sql`). Phases 2–4 are documented here so we don't
> design ourselves into a corner — they will be applied in their respective
> rollout phases.

> **Read alongside**: `docs/database-schema.md` (existing schema, inferred from
> source). This document picks up where that one leaves off.

---

## Table of contents

1. [Goals & guiding principles](#1-goals--guiding-principles)
2. [Existing schema recap](#2-existing-schema-recap)
3. [Phase 1 — Visibility foundations](#3-phase-1--visibility-foundations)
4. [Phase 2 — Profiles & follow graph](#4-phase-2--profiles--follow-graph)
5. [Phase 3 — Likes, comments, watched-with](#5-phase-3--likes-comments-watched-with)
6. [Phase 4 — Posts / notes feed](#6-phase-4--posts--notes-feed)
7. [Full ER diagram (post-Phase-4)](#7-full-er-diagram-post-phase-4)
8. [RLS policy catalogue](#8-rls-policy-catalogue)
9. [Indexes](#9-indexes)
10. [Open questions / deferred decisions](#10-open-questions--deferred-decisions)

---

## 1. Goals & guiding principles

Rankr is being converted from a personal-journal app into a **Beli-style social
ranking app**: users keep curated, ranked lists of media, optionally share them
publicly, follow other users, and discuss items.

Schema-level principles:

- **Private by default.** Every new row that *could* be public starts private.
  Users opt-in to publishing on a per-list (and per-profile, per-post) basis.
- **Ownership is always an `auth.users.id` FK.** Never trust client-supplied
  user IDs; always derive from `auth.uid()` in RLS policies and insert defaults.
- **Soft-deletes are out of scope.** Hard-delete with `ON DELETE CASCADE` on
  child rows. Account-deletion is Phase 5 territory.
- **RLS is mandatory on every public-facing table.** No table is exposed
  without an explicit policy set.
- **Public-readability is composed.** A `list_item` is publicly readable iff
  its parent `list.visibility = 'public'`. A `comment` is readable iff its
  target `list_item` is readable. Reads cascade through joins.
- **Write paths are tight.** Inserts/updates/deletes always check
  `auth.uid() = owner_id`. Comments on others' items are allowed only when the
  target item is on a public list.

---

## 2. Existing schema recap

For full detail see `docs/database-schema.md`. Quick reference:

### Tables

| Table         | Purpose                                              |
|---------------|------------------------------------------------------|
| `auth.users`  | Supabase-managed auth identity                        |
| `profiles`    | User-facing display info (display_name, username, bio, avatar_url) |
| `lists`       | Top-level ranked collection (movies / games / music) |
| `list_items`  | Items inside a list (rank, sentiment, notes, photo_urls) |

### Storage buckets

| Bucket             | Public? | Use                                  |
|--------------------|---------|--------------------------------------|
| `avatars`          | yes     | Profile photos                        |
| `list-item-photos` | yes     | Per-item user-uploaded photos         |

### FK relationships (current)

```
auth.users.id  ──<  profiles.id          (1:1)
auth.users.id  ──<  lists.user_id        (1:many)
lists.id       ──<  list_items.list_id   (1:many)
```

---

## 3. Phase 1 — Visibility foundations

**Goal**: Lay the groundwork for public/private split *without* shipping any
user-facing social UI. After Phase 1, the database is *capable* of representing
public lists and profiles, but the client still treats everything as private.

### Schema changes

#### 3.1 `lists.visibility`

Add a per-list visibility flag.

```sql
ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('public', 'private'));
```

| Value     | Meaning                                                   |
|-----------|-----------------------------------------------------------|
| `private` | Default. Only the owner (`auth.uid() = user_id`) can SELECT. |
| `public`  | Anyone (anon or authed) can SELECT.                       |

**Why a text column instead of boolean?** Forward compatibility — Phase 4
introduces a third tier (`followers`) for posts. Reusing the same shape across
tables keeps mental model simple. For lists we'll only support
`public | private` until/unless a Phase ≥5 introduces a "followers-only" tier.

#### 3.2 `profiles.username` — UNIQUE (partial index)

Existing rows may have `NULL` usernames. We want uniqueness on **non-null**
values, so a partial unique index is used instead of a column-level constraint:

```sql
DROP INDEX IF EXISTS profiles_username_key;
CREATE UNIQUE INDEX profiles_username_key
  ON public.profiles (username)
  WHERE username IS NOT NULL;
```

This allows existing users without a username to coexist while still
guaranteeing that two new signups can't claim the same handle.

Frontend responsibility (deferred — see `docs/onboarding-flow-todo.md`): the
signup/onboarding flow must require a username before letting the user into
the app.

#### 3.3 `profiles.is_public`

Independent of `lists.visibility` — controls whether the *profile page itself*
is viewable. A user can have `is_public = true` but all lists `visibility =
'private'`: their handle, bio, avatar are public, but they share no rankings.

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
```

Default `true` because the existing UX already treats profiles as semi-public
(display_name visible wherever the user appears). Users can opt into a private
profile via settings later.

### RLS policies added in Phase 1

| Table        | Policy                                            | Operation | USING clause |
|--------------|---------------------------------------------------|-----------|--------------|
| `lists`      | "Public lists viewable by everyone"               | SELECT    | `visibility = 'public'` |
| `list_items` | "Items of public lists viewable by everyone"     | SELECT    | `EXISTS(SELECT 1 FROM lists WHERE lists.id = list_items.list_id AND lists.visibility = 'public')` |
| `profiles`   | "Public profiles viewable by everyone"            | SELECT    | `is_public = true` |

These are **additive** policies — they layer on top of the existing per-owner
SELECT policies (owner can always read their own data regardless of visibility).
Postgres RLS treats multiple permissive policies as OR'd, so a user matching
*any* of them gets read access.

### What Phase 1 does NOT do

- Does **not** create the follow graph (Phase 2).
- Does **not** allow likes or comments (Phase 3).
- Does **not** add a posts table (Phase 4).
- Does **not** modify the frontend. Visibility toggles in UI are a separate task.

---

## 4. Phase 2 — Profiles & follow graph

**Goal**: Users can follow each other; the follow graph powers a "people you
follow" feed and a follower count badge.

### 4.1 `follows` table

```sql
CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);
```

Composite PK on `(follower_id, followed_id)` doubles as a uniqueness
guarantee — you can't follow the same person twice. The CHECK constraint
prevents self-follows.

#### Indexes

```sql
-- "Who do I follow?"  fast lookup by follower_id
CREATE INDEX idx_follows_follower_id ON public.follows (follower_id);

-- "Who follows me?"   fast lookup by followed_id
CREATE INDEX idx_follows_followed_id ON public.follows (followed_id);

-- "How many followers does X have?" — already served by the above (count via index scan)
```

The PK index covers `(follower_id, followed_id)` queries but not single-column
lookups, hence the two separate single-column indexes.

### 4.2 RLS — `follows`

| Policy                              | Operation | USING / WITH CHECK |
|-------------------------------------|-----------|--------------------|
| "Follows are public"                | SELECT    | `true` — anyone can see who follows whom (Beli-style transparency) |
| "Users follow on their own behalf"  | INSERT    | `WITH CHECK (follower_id = auth.uid())` |
| "Users unfollow on their own behalf"| DELETE    | `USING (follower_id = auth.uid())` |
| (no UPDATE policy — follow rows are immutable; you delete + re-create)  | UPDATE | — |

> **Note**: If the user prefers private follow graphs (Twitter-style protected
> accounts), change the SELECT policy to require either `follower_id =
> auth.uid()` OR `followed_id = auth.uid()` OR `EXISTS profile.is_public`.
> Documented as an Open Question (§10).

### 4.3 Profile changes

No schema changes required to `profiles` in Phase 2. The follow counts are
derived at query time:

```sql
-- followers of X
SELECT COUNT(*) FROM follows WHERE followed_id = X;

-- following count for X
SELECT COUNT(*) FROM follows WHERE follower_id = X;
```

If counts become a hot path, add denormalized `follower_count` / `following_count`
columns on `profiles` maintained by triggers — but defer until measured.

---

## 5. Phase 3 — Likes, comments, watched-with

**Goal**: Engagement on `list_items`. Users can like another user's ranked
item, comment on it, or tag friends as "watched/listened/played with."

### 5.1 `likes` table

```sql
CREATE TABLE public.likes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_item_id  uuid NOT NULL REFERENCES public.list_items(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, list_item_id)
);
```

UNIQUE on `(user_id, list_item_id)` prevents duplicate likes. The surrogate
`id` is kept for stable URLs/sort tiebreaks; the natural unique key is
`(user_id, list_item_id)`.

#### Indexes

```sql
-- "Items I've liked" — index already covers via UNIQUE; explicit:
CREATE INDEX idx_likes_user_id ON public.likes (user_id);

-- "Who liked this item?" — and total like count
CREATE INDEX idx_likes_list_item_id ON public.likes (list_item_id);
```

### 5.2 `comments` table

```sql
CREATE TABLE public.comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_item_id  uuid NOT NULL REFERENCES public.list_items(id) ON DELETE CASCADE,
  body          text NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  created_at    timestamptz NOT NULL DEFAULT now(),
  edited_at     timestamptz NULL
);
```

`edited_at NULL` means never edited. Body length cap of 500 is generous for
short replies; longer-form thoughts belong in Phase 4's `posts`.

#### Indexes

```sql
-- "Comments on this item" — primary read path
CREATE INDEX idx_comments_list_item_id_created_at
  ON public.comments (list_item_id, created_at DESC);

-- "Comments I've written"
CREATE INDEX idx_comments_user_id ON public.comments (user_id);
```

### 5.3 `watched_with` table

```sql
CREATE TABLE public.watched_with (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_item_id    uuid NOT NULL REFERENCES public.list_items(id) ON DELETE CASCADE,
  tagged_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_item_id, tagged_user_id)
);
```

Only the item owner inserts here (the user is tagging *their* item with a
friend). The tagged user is not asked for consent in v1; if abuse becomes a
problem, add an `accepted_at` column and require the tagged user to confirm.

> Note: This table intentionally has no `body` / `note` column — it's a pure
> association. A user wanting to add narrative ("Watched with @alice on her
> birthday") puts that in the item's `notes` field.

#### Indexes

```sql
-- "Who's tagged in this item?"
CREATE INDEX idx_watched_with_list_item_id ON public.watched_with (list_item_id);

-- "What items am I tagged in?" — feeds the "tagged" tab on a profile
CREATE INDEX idx_watched_with_tagged_user_id ON public.watched_with (tagged_user_id);
```

### 5.4 RLS — Phase 3 tables

**`likes`**

| Policy                                           | Op     | Clause |
|--------------------------------------------------|--------|--------|
| "Likes visible when item is visible"            | SELECT | `EXISTS(SELECT 1 FROM list_items li JOIN lists l ON l.id = li.list_id WHERE li.id = likes.list_item_id AND (l.visibility = 'public' OR l.user_id = auth.uid()))` |
| "Users like on their own behalf"                 | INSERT | `WITH CHECK (user_id = auth.uid() AND EXISTS(SELECT 1 FROM list_items li JOIN lists l ON l.id = li.list_id WHERE li.id = list_item_id AND l.visibility = 'public'))` |
| "Users unlike on their own behalf"               | DELETE | `USING (user_id = auth.uid())` |

Key edge case: you can only like items on **public** lists. Liking your own
private item is allowed via the inner OR-branch in SELECT, but the INSERT
policy explicitly requires the target list to be public — you can't pre-like
your own private items (semantically meaningless anyway).

**`comments`**

| Policy                                         | Op     | Clause |
|------------------------------------------------|--------|--------|
| "Comments visible when item is visible"       | SELECT | same shape as likes-SELECT above |
| "Comments allowed on public items"            | INSERT | `WITH CHECK (user_id = auth.uid() AND EXISTS(SELECT 1 FROM list_items li JOIN lists l ON l.id = li.list_id WHERE li.id = list_item_id AND l.visibility = 'public'))` |
| "Users edit their own comments"               | UPDATE | `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())` |
| "Users delete their own comments"             | DELETE | `USING (user_id = auth.uid())` |
| "Item owners delete comments on their items"  | DELETE | `USING (EXISTS(SELECT 1 FROM list_items li JOIN lists l ON l.id = li.list_id WHERE li.id = comments.list_item_id AND l.user_id = auth.uid()))` |

The "item owners delete" policy is permissive (OR'd with the self-delete
policy), so an item owner can moderate comments on their own item.

**`watched_with`**

| Policy                                                    | Op     | Clause |
|-----------------------------------------------------------|--------|--------|
| "Watched-with visible when item is visible"              | SELECT | same shape as comments-SELECT |
| "Item owner tags users on their own items"                | INSERT | `WITH CHECK (EXISTS(SELECT 1 FROM list_items li JOIN lists l ON l.id = li.list_id WHERE li.id = list_item_id AND l.user_id = auth.uid()))` |
| "Item owner removes tags"                                 | DELETE | `USING (EXISTS(SELECT 1 FROM list_items li JOIN lists l ON l.id = li.list_id WHERE li.id = watched_with.list_item_id AND l.user_id = auth.uid()))` |
| "Tagged user removes themselves"                          | DELETE | `USING (tagged_user_id = auth.uid())` |

The tagged user can untag themselves from any item — important for consent /
abuse mitigation.

---

## 6. Phase 4 — Posts / notes feed

**Goal**: Twitter-style short-form posts. Optionally attach a `list_item` (e.g.
"Just rewatched this — still incredible" with the movie attached). Posts have
three visibility tiers.

### 6.1 `posts` table

```sql
CREATE TABLE public.posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body          text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  list_item_id  uuid NULL REFERENCES public.list_items(id) ON DELETE SET NULL,
  visibility    text NOT NULL DEFAULT 'private'
                  CHECK (visibility IN ('public', 'followers', 'private')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

| Visibility   | Who can SELECT                                              |
|--------------|-------------------------------------------------------------|
| `private`    | Only the author (`auth.uid() = user_id`).                   |
| `followers`  | The author + anyone in `follows` where `followed_id = post.user_id`. |
| `public`     | Anyone (anon or authed).                                    |

`list_item_id` uses `ON DELETE SET NULL` (not `CASCADE`) — if the user deletes
the underlying ranked item, the post survives with the reference cleared. The
post's narrative content matters; the attachment is decorative.

#### Indexes

```sql
-- Author's posts, newest first
CREATE INDEX idx_posts_user_id_created_at ON public.posts (user_id, created_at DESC);

-- Global public feed
CREATE INDEX idx_posts_visibility_created_at
  ON public.posts (visibility, created_at DESC)
  WHERE visibility = 'public';

-- Posts referencing a particular item
CREATE INDEX idx_posts_list_item_id ON public.posts (list_item_id) WHERE list_item_id IS NOT NULL;
```

### 6.2 RLS — `posts`

| Policy                                | Op     | Clause |
|---------------------------------------|--------|--------|
| "Authors see all their own posts"     | SELECT | `user_id = auth.uid()` |
| "Public posts viewable by everyone"   | SELECT | `visibility = 'public'` |
| "Follower posts viewable by followers"| SELECT | `visibility = 'followers' AND EXISTS(SELECT 1 FROM follows WHERE follower_id = auth.uid() AND followed_id = posts.user_id)` |
| "Users post on their own behalf"      | INSERT | `WITH CHECK (user_id = auth.uid())` |
| "Users edit their own posts"          | UPDATE | `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())` |
| "Users delete their own posts"        | DELETE | `USING (user_id = auth.uid())` |

Three permissive SELECT policies are OR'd at runtime. A user trying to read a
followers-only post that's not theirs and that they don't follow will fail
all three USING clauses.

---

## 7. Full ER diagram (post-Phase-4)

```
                        ┌──────────────────────┐
                        │     auth.users       │
                        │   (Supabase-managed) │
                        └────────────┬─────────┘
                                     │ id (uuid)
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
       ┌────────────┐         ┌────────────┐         ┌────────────┐
       │  profiles  │         │   lists    │         │  follows   │
       │            │         │            │         │ follower_id│
       │ id (PK,FK) │         │  user_id   │         │ followed_id│
       │ username   │         │  category  │         │ (composite │
       │ bio        │         │ visibility │         │   PK)      │
       │ avatar_url │         │  title     │         └────────────┘
       │ is_public  │         └─────┬──────┘
       └────────────┘               │ id
                                    ▼
                            ┌──────────────┐
                            │  list_items  │
                            │   list_id    │
                            │  external_id │
                            │  rank        │
                            │  sentiment   │
                            │  notes       │
                            │  photo_urls  │
                            └──────┬───────┘
                                   │ id
              ┌────────────────────┼─────────────────────┐
              │                    │                     │
              ▼                    ▼                     ▼
       ┌────────────┐       ┌────────────┐       ┌──────────────┐
       │   likes    │       │  comments  │       │ watched_with │
       │            │       │            │       │              │
       │ user_id    │       │ user_id    │       │ tagged_user  │
       │ list_item  │       │ body       │       │ list_item_id │
       │ UNIQUE     │       │ edited_at  │       │ UNIQUE       │
       └────────────┘       └────────────┘       └──────────────┘

       ┌────────────┐
       │   posts    │
       │            │
       │ user_id    │──── FK → auth.users
       │ body       │
       │ list_item  │──── FK → list_items (nullable, SET NULL on delete)
       │ visibility │
       └────────────┘
```

---

## 8. RLS policy catalogue

Master reference — every policy on every table, ordered by phase.

### Phase 0 (existing, recommended in `database-schema.md`)

| Table         | Policy (existing/recommended)                 | Op       | Clause |
|---------------|-----------------------------------------------|----------|--------|
| `profiles`    | "Read any profile" (legacy authenticated)    | SELECT   | `auth.role() = 'authenticated'` *(superseded by Phase 1)* |
| `profiles`    | "Insert own profile"                          | INSERT   | `id = auth.uid()` |
| `profiles`    | "Update own profile"                          | UPDATE   | `id = auth.uid()` |
| `lists`       | "Read own lists"                              | SELECT   | `user_id = auth.uid()` |
| `lists`       | "Insert own lists"                            | INSERT   | `user_id = auth.uid()` |
| `lists`       | "Update own lists"                            | UPDATE   | `user_id = auth.uid()` |
| `lists`       | "Delete own lists"                            | DELETE   | `user_id = auth.uid()` |
| `list_items`  | "Read items in own lists" (via EXISTS join)  | SELECT   | `EXISTS(SELECT 1 FROM lists WHERE lists.id = list_items.list_id AND lists.user_id = auth.uid())` |
| `list_items`  | "Insert/update/delete items in own lists"    | I/U/D    | same EXISTS join |

### Phase 1 (this rollout)

| Table        | Policy                                       | Op     | Clause |
|--------------|----------------------------------------------|--------|--------|
| `lists`      | "Public lists viewable by everyone"         | SELECT | `visibility = 'public'` |
| `list_items` | "Items of public lists viewable by everyone"| SELECT | `EXISTS(SELECT 1 FROM lists WHERE lists.id = list_items.list_id AND lists.visibility = 'public')` |
| `profiles`   | "Public profiles viewable by everyone"      | SELECT | `is_public = true` |

### Phase 2

| Table     | Policy                                | Op     | Clause |
|-----------|---------------------------------------|--------|--------|
| `follows` | "Follows are public"                  | SELECT | `true` |
| `follows` | "Users follow on their own behalf"    | INSERT | `follower_id = auth.uid()` |
| `follows` | "Users unfollow on their own behalf"  | DELETE | `follower_id = auth.uid()` |

### Phase 3

See §5.4 for the full set. Summary:

| Table         | Policies                                                            |
|---------------|---------------------------------------------------------------------|
| `likes`       | SELECT (visible when item visible) · INSERT/DELETE own              |
| `comments`    | SELECT · INSERT (only on public items) · UPDATE/DELETE own · DELETE as item owner |
| `watched_with`| SELECT · INSERT/DELETE as item owner · DELETE as tagged user        |

### Phase 4

See §6.2. Three permissive SELECT policies (own / public / followers) plus
own-only INSERT/UPDATE/DELETE.

---

## 9. Indexes

Master list of indexes introduced across phases (in addition to the existing
ones in `database-schema.md` §"Recommended Indexes").

### Phase 1

```sql
-- Already in the migration: profiles_username_key (partial unique)
CREATE UNIQUE INDEX profiles_username_key
  ON public.profiles (username) WHERE username IS NOT NULL;

-- Recommended: index visibility for the "public lists" scans
CREATE INDEX IF NOT EXISTS idx_lists_visibility
  ON public.lists (visibility) WHERE visibility = 'public';
```

> The `idx_lists_visibility` index is recommended but **not** in the Phase 1
> migration. Add only if `EXPLAIN ANALYZE` shows a sequential scan on the
> "browse public lists" query under load. For a small user base it's wasted IO.

### Phase 2

```sql
CREATE INDEX idx_follows_follower_id ON public.follows (follower_id);
CREATE INDEX idx_follows_followed_id ON public.follows (followed_id);
```

### Phase 3

```sql
CREATE INDEX idx_likes_user_id      ON public.likes (user_id);
CREATE INDEX idx_likes_list_item_id ON public.likes (list_item_id);

CREATE INDEX idx_comments_list_item_id_created_at
  ON public.comments (list_item_id, created_at DESC);
CREATE INDEX idx_comments_user_id   ON public.comments (user_id);

CREATE INDEX idx_watched_with_list_item_id   ON public.watched_with (list_item_id);
CREATE INDEX idx_watched_with_tagged_user_id ON public.watched_with (tagged_user_id);
```

### Phase 4

```sql
CREATE INDEX idx_posts_user_id_created_at ON public.posts (user_id, created_at DESC);
CREATE INDEX idx_posts_visibility_created_at
  ON public.posts (visibility, created_at DESC) WHERE visibility = 'public';
CREATE INDEX idx_posts_list_item_id ON public.posts (list_item_id) WHERE list_item_id IS NOT NULL;
```

---

## 10. Open questions / deferred decisions

1. **Private follow graph?** Currently all follows are public (Beli-style).
   If we want Twitter-protected-account semantics later, gate `follows.SELECT`
   behind `profiles.is_public` or a new `profiles.follows_visible` flag.
   Migration is a single `DROP POLICY` + `CREATE POLICY`.

2. **Block list?** Not designed. When abuse becomes a concern, introduce a
   `blocks` table mirroring `follows` (blocker_id, blocked_id, composite PK).
   RLS on every social table then needs to also check the block list.

3. **Notifications?** A `notifications` table with `recipient_id`, `actor_id`,
   `type` ('follow' | 'like' | 'comment' | 'tag'), `target_list_item_id`,
   `seen_at`. Populated by triggers on the source tables. Deferred to Phase 5+.

4. **Post replies / threading?** Phase 4 `posts` has no `parent_post_id`
   column. If we want threaded replies, add `parent_post_id uuid NULL
   REFERENCES posts(id) ON DELETE CASCADE` and an index.

5. **Reposts / quote-posts?** Same deferral. Could be a `reposts` table or a
   `repost_of_post_id` column on `posts`.

6. **Lists shared between users (collaborative lists)?** Not in the current
   model — a list has exactly one owner. If introduced, replace `lists.user_id`
   with a `list_members` join table (`list_id`, `user_id`, `role`).

7. **Soft delete / undo?** No `deleted_at` columns. If users start asking for
   "restore deleted list," add `deleted_at timestamptz NULL` and update every
   policy with `AND deleted_at IS NULL`. Sizeable retrofit; defer until asked.

8. **Photo attachments on posts?** Phase 4 posts are text-only. To add photos,
   introduce a `post_photos` table (post_id, url, position) and a storage
   bucket `post-photos`. Defer until product confirms the need.

9. **Username case-folding.** The partial unique index in §3.2 is
   case-sensitive at the database level — `Alice` and `alice` are distinct.
   For case-insensitive uniqueness we'd need either `LOWER(username)` indexed
   uniquely *or* a CHECK constraint forcing lowercase. Recommended: enforce
   lowercase in `validateUsername` (frontend + `lib/profile.ts`) and call it
   a day. Documented in `lib/profile.ts` JSDoc.

10. **`profiles.onboarded_at`** — referenced by `docs/onboarding-flow-todo.md`
    but not yet added to the schema. Will land alongside the onboarding flow
    implementation. Column shape:
    `ALTER TABLE profiles ADD COLUMN onboarded_at timestamptz NULL;`
