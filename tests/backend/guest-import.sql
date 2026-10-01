\set ON_ERROR_STOP on
-- Run against an empty isolated test database with anon/authenticated roles.
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.lists(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id),title text NOT NULL,category text NOT NULL,visibility text NOT NULL);
CREATE TABLE public.list_items(id uuid PRIMARY KEY,list_id uuid REFERENCES public.lists(id),title text NOT NULL,subtitle text,image_url text,external_id text,category text,rank float8,sentiment text,notes text,bookmarked boolean);
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
\ir ../../supabase/migrations/202609300003_guest_list_import.sql
CREATE FUNCTION public.test_draft(draft_id text DEFAULT '33333333-3333-4333-8333-333333333333') RETURNS jsonb LANGUAGE sql AS $$
SELECT jsonb_build_object('version',1,'id',draft_id,'title','Favorites','category','movies','items',jsonb_build_array(
 jsonb_build_object('id','44444444-4444-4444-8444-444444444444','title','First','image_url','/media/poster.webp'),
 jsonb_build_object('id','55555555-5555-4555-8555-555555555555','title','Second','image_url','https://images.example.test/poster.jpg')))
$$;
SET ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.rankr_import_guest_list(public.test_draft()); RAISE EXCEPTION 'anonymous call accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.rankr_import_guest_list(public.test_draft()); RAISE EXCEPTION 'missing auth accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SELECT * FROM public.rankr_import_guest_list(public.test_draft() || '{"user_id":"22222222-2222-4222-8222-222222222222"}'::jsonb);
SELECT * FROM public.rankr_import_guest_list(public.test_draft() || '{"title":"Changed retry"}'::jsonb);
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.lists) <> 1 OR (SELECT count(*) FROM public.list_items) <> 2 THEN RAISE EXCEPTION 'not idempotent'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.lists WHERE user_id='11111111-1111-4111-8111-111111111111' AND title='Favorites' AND visibility='private') THEN RAISE EXCEPTION 'owner/privacy changed'; END IF;
 IF (SELECT image_url FROM public.list_items WHERE title='First') <> 'https://rankr-app.vercel.app/media/poster.webp' OR (SELECT image_url FROM public.list_items WHERE title='Second') <> 'https://images.example.test/poster.jpg' THEN RAISE EXCEPTION 'artwork origin normalization failed'; END IF;
 IF (SELECT rank FROM public.list_items WHERE title='First') <> 10 OR (SELECT rank FROM public.list_items WHERE title='Second') <> 1 THEN RAISE EXCEPTION 'rank order changed'; END IF;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$ BEGIN
 BEGIN PERFORM public.rankr_import_guest_list(public.test_draft()); RAISE EXCEPTION 'owner collision accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$ DECLARE payload jsonb; BEGIN
 -- Unique draft but colliding item IDs: insertion fails after list creation;
 -- the enclosing RPC transaction must leave neither list nor import ledger.
 BEGIN PERFORM public.rankr_import_guest_list(public.test_draft('66666666-6666-4666-8666-666666666666')); RAISE EXCEPTION 'item collision accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
 FOREACH payload IN ARRAY ARRAY[
   public.test_draft() || '{"category":"invalid"}'::jsonb,
   public.test_draft() || '{"items":[]}'::jsonb,
   public.test_draft() || jsonb_build_object('items',(SELECT jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'title','Item')) FROM generate_series(1,21))),
   public.test_draft() || '{"title":null}'::jsonb,
   jsonb_set(public.test_draft(),'{items,1,image_url}','"javascript:alert(1)"'),
   jsonb_set(public.test_draft(),'{items,1,image_url}','"/media/../secret"'),
   jsonb_set(public.test_draft(),'{items,1,notes}',to_jsonb(repeat('x',4001))),
   jsonb_set(public.test_draft(),'{items,1,id}','"44444444-4444-4444-8444-444444444444"')
 ] LOOP
  BEGIN PERFORM public.rankr_import_guest_list(payload); RAISE EXCEPTION 'invalid payload accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 END LOOP;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.lists) <> 1 OR (SELECT count(*) FROM public.list_items) <> 2 OR (SELECT count(*) FROM public.guest_list_imports) <> 1 THEN RAISE EXCEPTION 'partial write leaked'; END IF;
END $$;
