\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.lists(id uuid PRIMARY KEY,user_id uuid,visibility text);
CREATE TABLE public.list_items(id uuid PRIMARY KEY,list_id uuid,photo_urls text[]);
CREATE TABLE public.user_blocks(blocker_id uuid,blocked_id uuid);
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
GRANT ALL ON storage.objects TO anon,authenticated,service_role;
CREATE POLICY legacy_wide_open ON storage.objects FOR ALL TO public USING(true) WITH CHECK(true);
\ir ../../supabase/migrations/202609300001_private_photos.sql
\ir ../../supabase/migrations/202609300002_encrypted_content.sql
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
INSERT INTO storage.objects(bucket_id,name) VALUES ('list-item-photos','11111111-1111-4111-8111-111111111111/private.jpg'),('list-item-photos','11111111-1111-4111-8111-111111111111/public.jpg');
INSERT INTO public.lists VALUES ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','public');
INSERT INTO public.list_items VALUES ('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333',ARRAY['storage://list-item-photos/11111111-1111-4111-8111-111111111111/public.jpg']);
SET ROLE anon;
DO $$ BEGIN IF (SELECT count(*) FROM storage.objects) <> 1 THEN RAISE EXCEPTION 'anonymous private exposure'; END IF; END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$ BEGIN IF (SELECT count(*) FROM storage.objects) <> 2 THEN RAISE EXCEPTION 'owner denied'; END IF; END $$;
INSERT INTO storage.objects(bucket_id,name) VALUES ('list-item-photos','11111111-1111-4111-8111-111111111111/new.jpg');
DO $$ BEGIN
 BEGIN INSERT INTO storage.objects(bucket_id,name) VALUES ('list-item-photos','22222222-2222-4222-8222-222222222222/evil.jpg'); RAISE EXCEPTION 'cross-owner insert allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS (SELECT FROM public.encrypted_content) THEN NULL; END IF;
 RAISE EXCEPTION 'client vault read allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ DECLARE n integer; BEGIN UPDATE storage.objects SET name=name WHERE bucket_id='list-item-photos'; GET DIAGNOSTICS n=ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'overwrite allowed'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$ BEGIN IF (SELECT count(*) FROM storage.objects) <> 1 THEN RAISE EXCEPTION 'stranger exposure'; END IF; END $$;
DO $$ DECLARE n integer; BEGIN DELETE FROM storage.objects WHERE bucket_id='list-item-photos'; GET DIAGNOSTICS n=ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'cross-owner deletion allowed'; END IF; END $$;
RESET ROLE;
INSERT INTO user_blocks VALUES ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
SET ROLE authenticated;
DO $$ BEGIN IF (SELECT count(*) FROM storage.objects) <> 0 THEN RAISE EXCEPTION 'block bypass'; END IF; END $$;
RESET ROLE;
SET ROLE service_role;
DO $$ DECLARE n integer; i integer; BEGIN
 FOR i IN 1..60 LOOP IF NOT public.rankr_content_take_quota('11111111-1111-4111-8111-111111111111') THEN RAISE EXCEPTION 'early quota'; END IF; END LOOP;
 IF public.rankr_content_take_quota('11111111-1111-4111-8111-111111111111') THEN RAISE EXCEPTION 'quota bypass'; END IF;
 SELECT count(*) INTO n FROM public.rankr_content_write('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','post',repeat('A',24),repeat('A',16),'v1',0);
 IF n <> 1 THEN RAISE EXCEPTION 'create failed'; END IF;
 SELECT count(*) INTO n FROM public.rankr_content_write('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','post',repeat('A',24),repeat('A',16),'v1',0);
 IF n <> 0 THEN RAISE EXCEPTION 'CAS create failed'; END IF;
 SELECT count(*) INTO n FROM public.rankr_content_write('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','post',repeat('A',24),repeat('A',16),'v1',1);
 IF n <> 1 THEN RAISE EXCEPTION 'CAS update failed'; END IF;
 SELECT count(*) INTO n FROM public.rankr_content_write('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','post',repeat('A',24),repeat('A',16),'v1',1);
 IF n <> 0 THEN RAISE EXCEPTION 'stale CAS accepted'; END IF;
END $$;
RESET ROLE;
