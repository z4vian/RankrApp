---
version: 1
slug: "app-auth-and-signed-in"
primary_target: "app/(auth)/login.tsx"
related_targets: ["app/(auth)/signup.tsx", "app/(auth)/forgot-password.tsx", "app/(tabs)/_layout.web.tsx", "app/(tabs)/index.web.tsx", "app/(tabs)/lists/index.tsx", "app/reset-password.tsx", "app/+html.tsx", "lib/theme.ts"]
---

# Authentication and signed-in web application

Mode: Operate. Extend the user-approved landing world into login, signup, recovery, the signed-in navigation shell, home feed, and list collection. The user explicitly requested this extension; no new visual direction or comp round.

Use charcoal #14181c, neutral surfaces, violet #7651e4 primary actions, pale violet selections, and self-hosted Inter. Native keeps its existing palette and platform font. Web app typography loads directly from root HTML, including direct auth/deep-link visits. Do not edit the approved landing composition.

Authentication keeps existing Supabase flows, OAuth callbacks, password checks, and explicit legal consent. Form controls stay 52px high with readable labels and subdued borders. Forms are constrained to a 440px content measure, scroll on small screens, and use the shared geometric wordmark. Error and disabled states remain visible.

Signed-in desktop uses a persistent 224px sidebar, constrained feed, and follow suggestions at wide widths. Mobile uses bottom navigation with visible labels and adequate height. Lists are width-constrained on desktop. Content and familiar operations take priority over marketing display scale.

Verification: desktop 1440x1000 and mobile 390x844, keyboard-accessible login error/password visibility, direct-route fonts, overflow and axe checks. Populated feed and list screenshots use browser-intercepted synthetic Supabase responses exclusively. They verify rendering, not live account access, real network authentication, authorization rules, or production data.
