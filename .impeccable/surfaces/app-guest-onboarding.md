---
version: 1
slug: "app-guest-onboarding"
primary_target: "app/try.tsx"
related_targets: ["app/walkthrough.tsx", "app/landing.web.tsx", "app/(tabs)/profile-settings.tsx"]
---

# Guest-first list building and introduction

Mode: Operate. Extend the approved charcoal, violet, self-hosted Inter application world. The user has specified the product flow: demonstrate value before requiring an account. No new visual direction or comp round.

The landing's create-list calls to action enter /try. The first decision is a media category and list title. The guest then adds actual favorites manually or from an optional openly licensed starter catalog. The user's list order is the ranking. Move-up/down controls support keyboard and touch; optional top-two comparisons and undo provide the quick win. Only Save introduces account creation or login. Parent-owned routing preserves the draft through authentication and offers an explicit import confirmation.

Guest UI calls the shared draft API; it does not write to Supabase. Local drafts are described truthfully as unencrypted browser storage retained for up to seven days from last edit. Storage failure shows a session-only warning, including external-auth/refresh risk. Twenty favorites are allowed. The current list requires explicit confirmation before discarding. Catalog media retains its source/credit link.

Starter suggestions default collapsed behind a labeled expandable control, keeping the user’s ranking prominent on mobile. Desktop uses a 320px add column beside an ordered list within a 1120px wrapper. Mobile stacks the same operations. Form and primary action height is 52px; reordering/removal controls have 44px targets. One contextual hint explains the next meaningful action. Error/status messages have accessible announcement roles.

The signed-in walkthrough is a skippable full-page introduction, three steps following guest import or for accounts with a saved list, and four without a saved list. Choosing to keep a device draft without importing checks owned lists before selecting the introduction. Both completion and skip call the account completion helper; replay avoids a mutation. A supplied listId returns to that list, otherwise to Lists. The first full-tour step offers Build my first list, opening the actual guest builder without marking onboarding complete. Next and Skip remain available. Settings exposes the replay entry point. The walkthrough explains notes/reordering, visibility and discovery without silently editing the user's list.

Verification is coordinated by the parent across the integrated guest, auth, import and walkthrough paths. No duplicate visual exploration or independent deployment.
