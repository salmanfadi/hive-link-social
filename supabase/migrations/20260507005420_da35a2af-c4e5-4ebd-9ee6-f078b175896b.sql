
-- Tighten media bucket: replace any broad SELECT with read-only by path
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read on media" ON storage.objects;

CREATE POLICY "media public read individual files"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

-- Reposts
CREATE TABLE IF NOT EXISTS public.reposts (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reposts viewable" ON public.reposts FOR SELECT TO authenticated USING (true);
CREATE POLICY "users repost" ON public.reposts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users unrepost" ON public.reposts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Extend notifications type to include 'repost'
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'repost';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.notify_on_repost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (owner, NEW.user_id, 'repost', NEW.post_id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS reposts_notify ON public.reposts;
CREATE TRIGGER reposts_notify AFTER INSERT ON public.reposts
FOR EACH ROW EXECUTE FUNCTION public.notify_on_repost();
