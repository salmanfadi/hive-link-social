-- Rate limiting via PL/pgSQL triggers.
-- These run before INSERT and raise an exception if the user exceeds their quota.
-- Quotas: posts = 10/hour, comments = 30/hour, follows = 50/hour.

-- ─── Posts rate limit ────────────────────────────────────────────────────────
create or replace function public.check_post_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.posts
  where user_id = new.user_id
    and created_at > now() - interval '1 hour';

  if recent_count >= 10 then
    raise exception 'Rate limit exceeded: you can only create 10 posts per hour. Please wait before posting again.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_post_rate_limit on public.posts;
create trigger trg_post_rate_limit
  before insert on public.posts
  for each row execute function public.check_post_rate_limit();

-- ─── Comments rate limit ──────────────────────────────────────────────────────
create or replace function public.check_comment_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.comments
  where user_id = new.user_id
    and created_at > now() - interval '1 hour';

  if recent_count >= 30 then
    raise exception 'Rate limit exceeded: you can only post 30 comments per hour. Please wait before commenting again.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_comment_rate_limit on public.comments;
create trigger trg_comment_rate_limit
  before insert on public.comments
  for each row execute function public.check_comment_rate_limit();

-- ─── Follows: add created_at so we can time-window rate-limiting ──────────────
-- The original follows table has no created_at column. Add it now.
alter table public.follows
  add column if not exists created_at timestamptz not null default now();

-- ─── Follows rate limit ───────────────────────────────────────────────────────
create or replace function public.check_follow_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.follows
  where follower_id = new.follower_id
    and created_at > now() - interval '1 hour';

  if recent_count >= 50 then
    raise exception 'Rate limit exceeded: you can only follow 50 accounts per hour. Please wait before following more accounts.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_follow_rate_limit on public.follows;
create trigger trg_follow_rate_limit
  before insert on public.follows
  for each row execute function public.check_follow_rate_limit();
