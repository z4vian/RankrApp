-- Requires Rankr's existing lists, list_items and Phase 8 user_blocks tables.
-- Deploy the compatible client before applying. No object data is deleted.
BEGIN;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('list-item-photos', 'list-item-photos', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.rankr_can_read_photo(object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT (SELECT auth.uid())::text = split_part(object_name, '/', 1)
  OR EXISTS (
    SELECT 1 FROM public.lists l
    JOIN public.list_items li ON li.list_id = l.id
    WHERE l.user_id::text = split_part(object_name, '/', 1)
      AND l.visibility = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = (SELECT auth.uid()) AND b.blocked_id = l.user_id)
           OR (b.blocked_id = (SELECT auth.uid()) AND b.blocker_id = l.user_id)
      )
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(to_jsonb(li.photo_urls)) = 'array'
            THEN to_jsonb(li.photo_urls) ELSE '[]'::jsonb END
        ) AS photo(value)
        WHERE photo.value = 'storage://list-item-photos/' || object_name
          OR (photo.value LIKE 'https://%/storage/v1/object/public/list-item-photos/%'
              AND split_part(photo.value, '/storage/v1/object/public/list-item-photos/', 2) = object_name)
      )
  );
$$;
REVOKE ALL ON FUNCTION public.rankr_can_read_photo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rankr_can_read_photo(text) TO anon, authenticated;

-- Restrictive policies AND with existing permissive policies. A legacy
-- USING (true) policy cannot reopen this bucket. Other buckets are unaffected.
CREATE POLICY rankr_photos_read_guard ON storage.objects AS RESTRICTIVE
FOR SELECT TO public USING (
  bucket_id <> 'list-item-photos' OR public.rankr_can_read_photo(name));
CREATE POLICY rankr_photos_read ON storage.objects
FOR SELECT TO anon, authenticated USING (
  bucket_id = 'list-item-photos' AND public.rankr_can_read_photo(name));
CREATE POLICY rankr_photos_insert_guard ON storage.objects AS RESTRICTIVE
FOR INSERT TO public WITH CHECK (
  bucket_id <> 'list-item-photos' OR (
    (SELECT auth.uid()) IS NOT NULL AND split_part(name, '/', 1) = (SELECT auth.uid())::text
    AND name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$'));
CREATE POLICY rankr_photos_insert ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'list-item-photos' AND split_part(name, '/', 1) = (SELECT auth.uid())::text);
CREATE POLICY rankr_photos_no_overwrite ON storage.objects AS RESTRICTIVE
FOR UPDATE TO public USING (bucket_id <> 'list-item-photos')
WITH CHECK (bucket_id <> 'list-item-photos');
CREATE POLICY rankr_photos_delete_guard ON storage.objects AS RESTRICTIVE
FOR DELETE TO public USING (
  bucket_id <> 'list-item-photos' OR split_part(name, '/', 1) = (SELECT auth.uid())::text);
CREATE POLICY rankr_photos_delete ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'list-item-photos' AND split_part(name, '/', 1) = (SELECT auth.uid())::text);

CREATE OR REPLACE FUNCTION public.rankr_private_photos_ready()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'list-item-photos' AND NOT public); $$;
REVOKE ALL ON FUNCTION public.rankr_private_photos_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rankr_private_photos_ready() TO authenticated;
COMMIT;
