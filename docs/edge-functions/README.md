# Edge functions

Canonical deployable sources are `supabase/functions/`. The former files in this directory are deprecation notices; never copy them over the canonical sources.

- `delete-account`: caller JWT verified using Auth, Storage API cleanup then admin auth deletion. Verify deployed cascade relationships and storage layout first.
- `send-push-notification`: trusted servers only. Set a random server-only `RANKR_PUSH_SERVER_SECRET` (at least 32 characters), and send it in `x-rankr-push-secret`. The checked-in config disables gateway JWT verification only for this function, so its dedicated-secret check can authenticate server requests. An ordinary client JWT never grants dispatch. Do not embed the secret in the app or put it in a database GUC. Use a secret manager/Vault and a narrow server dispatch path. No production trigger is installed by this change.
- `secure-content`: caller JWT verified using Auth; server-held AES-256-GCM keys encrypt payloads. Set `RANKR_CONTENT_KEYS` and `RANKR_ACTIVE_CONTENT_KEY` only in function secrets. See `../BACKEND-ROLLOUT.md`.

Deploy from the repository root with the Supabase CLI after staging verification. Do not disable JWT gateway verification for deletion or secure-content; only push uses the explicitly configured custom server-secret path. There has been no production deployment from this review.
