# Rankr review — September 29, 2026

## What is already working in the product

Rankr has more than a landing page: media search across five categories, head-to-head comparisons, ranked lists, notes and sentiment, a social feed, follows, comments, profiles, recommendations, and account settings. The strongest proposition is a personal collection across media with a simple comparison mechanic. The next milestone should be one reliable browser journey: sign up → find three favorites → compare → view a list → share it.

## Changes in this refresh

The approved dark, feature-first homepage is implemented with a responsive ranked-list preview and a local-only comparison demo. Real public-domain artwork and one openly licensed game screenshot replace fictional generated covers. Credits and source metadata accompany every shipped image. Fonts and marketing images are self-hosted.

Privacy, Terms, and Cookie/Storage pages are reachable while signed out. Signup and feedback use explicit, unchecked, keyboard-operable agreement controls. Optional diagnostic details are separate from feedback consent. Google users and existing users pass through a versioned acknowledgement screen. Acceptance in user metadata is a client feature, not an immutable legal audit record.

Removed automatic external crash-reporting hooks and error details from feedback URLs. Web drafts remain in memory. Improved visible focus, contrast, reduced motion, labels, image alternatives, public form layout, and shared button semantics. Browser OAuth callbacks now use the website origin; provider allow-list configuration still needs verification.

## Priorities before a public launch

1. **Make private photos private.** `lib/photoUpload.ts` returns public bucket URLs. Move private uploads to private storage with signed URLs, authorize reads against list visibility, and test two distinct accounts. Database privacy does not protect a public image URL. Migrate existing files; do not merely change the UI label.
2. **Make account deletion authoritative and complete.** `lib/account.ts` deletes client-side rows before invoking the deletion function, so a server failure can leave a partially erased account. Move deletion orchestration to the authenticated backend, include uploaded files and related records, make retries safe, and confirm the deployed function and backup retention policy. No production data or backend settings were changed in this review.
3. **Finish browser parity.** Native alerts, bottom sheets, drag reordering, photo selection, sharing, and export need browser-specific verification. Provide Move up/Move down controls so ranking does not require dragging. Build a browser download for account export and a real web file-upload path. Test keyboard, touch, and screen readers in the authenticated app.
4. **Make exports complete and fail visibly.** `lib/account.ts` currently exports a subset of records, caps item results, and turns query failures into empty data. Paginate all relevant tables, include comments, likes, saved items, feedback/reports as appropriate, and distinguish missing information from an empty account.
5. **Verify backend access and abuse protections.** Test Supabase row-level security with anonymous, owner, and other-user sessions. Verify upload permissions, feedback permissions, rate limits, reporting/blocking, and OAuth callback URLs. Client-bundled metadata API keys are visible; proxy keys with quota or confidentiality requirements. A successful static build does not prove these backend settings.

## Product improvements after launch readiness

- Give new users a short three-item starter flow that ends with a usable list, rather than an empty dashboard.
- Explain where a new comparison will place an item and offer undo. Preserve progress when search fails.
- Make public list links the main sharing unit; preview the list while signed out and offer signup after exploration.
- Improve discovery with friend activity, category filters, and meaningful empty states before adding more feed complexity.
- Clarify whether music is tracks or albums throughout copy and data models. The current search is track-oriented.
- Add focused regression coverage for auth callbacks, owner/non-owner privacy, ranking updates, deletion failure, and exports. Avoid tests that only mirror rendered labels.

## Cookies and data minimization

For the reviewed build, optional analytics, advertising, and session replay are absent. The demo writes no persistent preference data. Authentication uses essential browser storage, so an accept-all banner would have no optional purpose to control. This is an implementation assessment for the stated US launch, not certification of every state-law obligation. Reassess before adding trackers or expanding geography, and inspect the actual deployed domain for host-injected scripts/cookies.

California's CCPA has business applicability thresholds and sale/sharing obligations; a small side project should not assume that all privacy laws have identical thresholds. Sources: [California Attorney General](https://oag.ca.gov/privacy/ccpa), [FTC data minimization guidance](https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business).

## Operator decisions still needed

Configure `EXPO_PUBLIC_OPERATOR_NAME` and `EXPO_PUBLIC_SUPPORT_EMAIL` before publishing. A dedicated forwarding alias is preferable to exposing a personal inbox; a new paid mailbox is unnecessary. Confirm retention periods, hosting/provider settings, and how unauthenticated privacy requests are handled. Policies describe current limitations honestly and should be reviewed against actual operations before launch.

## Media reuse

`lib/marketing-media.json` contains the title, local asset, creator, license, source URL, and modifications. `docs/media-license-evidence.json` retains the source statements checked during this work. `/image-credits` publishes attribution. Public-domain assessments are US-specific where applicable. The 0 A.D. screenshot is **copyrighted but licensed CC BY-SA 3.0**, with attribution and share-alike retained. These permissions do not clear unrelated contemporary posters, trademarks, actors' endorsements, or API-provided catalog artwork. Review provider display/attribution terms separately for authenticated search results.

## Validation scope

Static export and TypeScript passed. Targeted ESLint found no errors (one existing root route-effect dependency warning). The final axe run reported zero WCAG A/AA violations on the landing at 1536, 390 and 320 pixels and on privacy, terms, cookies, image credits, feedback, signup, login and reset-password. No horizontal overflow appeared at those landing widths. Category selection, demo reorder/reset and keyboard consent checks passed. The signed-out local session made no external requests and left cookies/local/session storage empty. The browser report under `.impeccable/review/browser-report.json` records automated accessibility and local interaction checks. No real signup, feedback, upload, deletion, or export was performed against a live account. Native device behavior and authenticated screen-reader operation remain unverified. Automated accessibility checks do not establish full WCAG conformance.

## Design workflow record

Impeccable was used for the approved canon direction, implementation review and design documentation. The user explicitly selected the latest image in chat, superseding a redundant variation round; the tool’s automatic phase gates did not fully pass. Original state and corrected semantic comparison regions are retained under `.impeccable/build`. A fresh generic subagent used the shipped reviewer contract because this harness does not expose named reviewer agent types. The review accepted visual composition and requested two bounded fixes: truthful persistence/spec evidence and password-hint spacing.

Final review verdict: **ship** at the scope of the two requested fixes, both resolved. Automated phase gates were not represented as passed.
