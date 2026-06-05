# Vercel Deployment Guide

This document walks through deploying Rankr to Vercel from a GitHub-linked project.

## What you've already done

- Created a Vercel project and linked it to the GitHub repo.

## What this PR adds

`vercel.json` at the project root tells Vercel exactly how to build and serve
the Expo static export.  You do **not** need to set the build command, output
directory, or framework in the Vercel dashboard — `vercel.json` overrides all
of those.

```json
{
  "buildCommand": "npx expo export -p web",
  "outputDirectory": "dist",
  "framework": null,
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [
    { "source": "/((?!.+\\..+).*)", "destination": "/index.html" }
  ]
}
```

The rewrite rule sends every URL that doesn't look like a file (no extension)
to `/index.html`, so React handles client-side routing for deep links like
`/profile/alice` or `/list/123` without a 404.

---

## Steps to complete your first deploy

### 1. Add environment variables in the Vercel dashboard

Your `.env` file is gitignored and never reaches Vercel's build environment.
Add these in **Vercel Dashboard → Your Project → Settings → Environment Variables**:

| Name | Value |
|------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | (your Supabase project URL) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | (your Supabase anon key) |
| `EXPO_PUBLIC_TMDB_API_KEY` | (your TMDB v3 read-access token) |
| `EXPO_PUBLIC_RAWG_API_KEY` | (your RAWG API key) |

Set all of them to apply to **Production**, **Preview**, and **Development**
environments so branch previews also work.

Note: if the variables are hardcoded directly in `lib/supabase.ts` rather than
pulled from `process.env`, skip the Supabase rows — they're already baked into
the bundle.  Add them anyway once you move to env-based config (recommended).

### 2. Push the branch that includes `vercel.json`

As soon as the commit containing `vercel.json` lands on your connected branch
(or merges to `main`), Vercel automatically picks up the new config and
re-runs the build.

```
git push origin main
```

### 3. Watch the build

Open **Vercel Dashboard → Deployments** and click the in-progress build.
Expected output:

- Build time: 3–6 minutes for a cold build (module graph is ~1 665 modules).
- Subsequent deploys (cached node_modules): ~90 seconds.
- Final output: a `dist/` directory with pre-rendered HTML for static routes
  and a shared JS bundle.

---

## Verifying the deploy

1. Open the Vercel-provided URL (e.g. `https://rankr-app-xyz.vercel.app`).
2. You should land on the login screen (`/(auth)/login`).
3. Sign in — you should reach the home feed tab.
4. Navigate to a deep route (e.g. `/profile/yourname`) and **hard-refresh**
   the page (`Ctrl+Shift+R` / `Cmd+Shift+R`).  It should reload correctly
   instead of returning a 404.  This confirms the rewrite rule is working.
5. On a wide browser window (≥ 1024 px), the sidebar nav should appear on the
   left instead of the mobile bottom tab bar.

---

## Supabase auth: add your Vercel URL as a redirect

This is **required** for Google OAuth (and any email magic-link flows) to work
on the deployed site.

1. Go to **Supabase Dashboard → Authentication → URL Configuration**.
2. Set **Site URL** to your primary domain:
   `https://rankr-app.vercel.app`  (replace with your actual slug).
3. Under **Redirect URLs**, add:
   - `https://rankr-app.vercel.app/**`
   - `https://rankr-app-*.vercel.app/**`  (covers preview deployments)
4. Save.

Without this, Supabase will reject the OAuth redirect and the user will see an
"invalid redirect URL" error after signing in via Google.

---

## Custom domain

1. In **Vercel Dashboard → Your Project → Settings → Domains**, add your
   domain (e.g. `rankr.app`).
2. Follow Vercel's instructions to point your DNS CNAME / A records at
   Vercel's edge network.
3. Once propagated, add the custom domain to Supabase's Redirect URLs as well:
   `https://rankr.app/**`

---

## When something breaks

### Build fails

Open the build log in the Vercel dashboard.  Common causes:

- **Missing env variable**: the Expo build will error if a required
  `EXPO_PUBLIC_*` variable is undefined.  Check the Environment Variables
  settings.
- **TypeScript error**: run `npx tsc --noEmit` locally to catch type errors
  before pushing.
- **OOM on first cold build**: if Vercel's free tier runs out of memory on the
  initial build, re-trigger the deployment — the second run typically succeeds
  with a warmed module cache.

### Page works locally but 404s on Vercel

The rewrite rule in `vercel.json` handles this.  If you're seeing 404s on
deep routes after the config is deployed, double-check that `vercel.json` is
at the **project root** (not inside `docs/` or `app/`).

### Auth callback broken after deploy

See the Supabase auth section above.  The most common cause is the deployed
origin not being in Supabase's Redirect URLs allowlist.

### Images / avatars not loading

If you host images on an external domain (e.g. S3, Cloudflare Images, TMDB
CDN), react-native-web's `<Image>` tag uses a plain `<img>` element and loads
them directly — no Vercel image proxy configuration needed.

If you use Next.js's `<Image>` optimisation in future, you would need to
whitelist domains in `next.config.js`, but Expo static export does not use
Next.js, so this does not apply here.

### CORS errors calling Supabase

Supabase's REST and Auth APIs send the correct CORS headers for browser
requests by default.  If you see CORS errors, verify that the request is
going to your project URL (`https://<ref>.supabase.co`) and not a localhost
address.

---

## Deployment checklist

- [ ] `vercel.json` is at project root
- [ ] All `EXPO_PUBLIC_*` env variables set in Vercel dashboard
- [ ] Vercel URL added to Supabase Redirect URLs
- [ ] First deploy completed without build errors
- [ ] Deep-link hard-refresh test passes (no 404)
- [ ] Sidebar appears on desktop browsers
