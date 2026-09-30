-- Application-encrypted payloads. This does not migrate existing plaintext rows.
BEGIN;
CREATE TABLE public.encrypted_content (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type IN
    ('profile','list','list_item','post','comment','report','feedback','preferences','other')),
  ciphertext text NOT NULL CHECK (length(ciphertext) BETWEEN 24 AND 88000),
  iv text NOT NULL CHECK (length(iv) = 16),
  key_id text NOT NULL CHECK (key_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  format_version smallint NOT NULL DEFAULT 1 CHECK (format_version = 1),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);
ALTER TABLE public.encrypted_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_content FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.encrypted_content FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.encrypted_content TO service_role;
-- No client RLS policies: every payload read/write passes through the authenticated function.

CREATE TABLE public.encrypted_content_rate_limits (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL
);
ALTER TABLE public.encrypted_content_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_content_rate_limits FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.encrypted_content_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.encrypted_content_rate_limits TO service_role;

CREATE FUNCTION public.rankr_content_take_quota(p_owner uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE used integer;
BEGIN
  INSERT INTO public.encrypted_content_rate_limits AS quota VALUES (p_owner, date_trunc('minute', now()), 1)
  ON CONFLICT (owner_id) DO UPDATE SET
    window_start = date_trunc('minute', now()),
    request_count = CASE WHEN quota.window_start = date_trunc('minute', now())
      THEN LEAST(quota.request_count + 1, 61) ELSE 1 END
  RETURNING request_count INTO used;
  RETURN used <= 60;
END; $$;

-- Revision 0 creates; a positive revision updates only that exact version.
-- Atomic compare-and-swap prevents a stale device from overwriting newer content.
CREATE FUNCTION public.rankr_content_write(
  p_owner uuid, p_id uuid, p_type text, p_ciphertext text, p_iv text,
  p_key_id text, p_expected_revision integer
) RETURNS SETOF public.encrypted_content
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_expected_revision = 0 THEN
    RETURN QUERY INSERT INTO public.encrypted_content(owner_id,id,content_type,ciphertext,iv,key_id)
      VALUES(p_owner,p_id,p_type,p_ciphertext,p_iv,p_key_id)
      ON CONFLICT DO NOTHING RETURNING *;
  ELSIF p_expected_revision > 0 THEN
    RETURN QUERY UPDATE public.encrypted_content
      SET ciphertext=p_ciphertext, iv=p_iv, key_id=p_key_id, revision=revision+1, updated_at=now()
      WHERE owner_id=p_owner AND id=p_id AND content_type=p_type AND revision=p_expected_revision
      RETURNING *;
  ELSE RAISE EXCEPTION 'Invalid revision';
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.rankr_content_take_quota(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rankr_content_write(uuid,uuid,text,text,text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rankr_content_take_quota(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rankr_content_write(uuid,uuid,text,text,text,text,integer) TO service_role;
COMMIT;
