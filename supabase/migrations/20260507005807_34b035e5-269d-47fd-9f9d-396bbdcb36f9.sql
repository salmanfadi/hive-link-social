
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS quoted_post_id uuid;

CREATE TABLE IF NOT EXISTS public.server_bans (
  server_id uuid NOT NULL,
  user_id uuid NOT NULL,
  banned_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (server_id, user_id)
);
ALTER TABLE public.server_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bans viewable" ON public.server_bans FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin bans" ON public.server_bans FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = server_id AND s.admin_id = auth.uid()));

CREATE POLICY "admin unbans" ON public.server_bans FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = server_id AND s.admin_id = auth.uid()));

-- Prevent banned users from joining or posting
CREATE OR REPLACE FUNCTION public.enforce_no_ban()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.server_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.server_bans b WHERE b.server_id = NEW.server_id AND b.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'User is banned from this community';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.enforce_no_ban() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS server_members_no_ban ON public.server_members;
CREATE TRIGGER server_members_no_ban BEFORE INSERT ON public.server_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_no_ban();

DROP TRIGGER IF EXISTS posts_no_ban ON public.posts;
CREATE TRIGGER posts_no_ban BEFORE INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_no_ban();
