
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  bio text,
  avatar_url text,
  did text unique not null,
  public_key text not null,
  wallet_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles viewable by authenticated" on public.profiles for select to authenticated using (true);
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_username text;
  final_username text;
  counter int := 0;
begin
  base_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g'));
  if base_username = '' then base_username := 'user'; end if;
  final_username := base_username;
  while exists(select 1 from public.profiles where username = final_username) loop
    counter := counter + 1;
    final_username := base_username || counter::text;
  end loop;

  insert into public.profiles (id, username, display_name, did, public_key)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'display_name', final_username),
    'did:hivelink:' || encode(gen_random_bytes(16), 'hex'),
    encode(gen_random_bytes(32), 'hex')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- SERVERS (communities)
create table public.servers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  rules text,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.servers enable row level security;
create policy "servers viewable by all auth" on public.servers for select to authenticated using (true);
create policy "auth users create servers" on public.servers for insert to authenticated with check (auth.uid() = admin_id);
create policy "admin updates server" on public.servers for update to authenticated using (auth.uid() = admin_id);
create policy "admin deletes server" on public.servers for delete to authenticated using (auth.uid() = admin_id);

-- SERVER MEMBERS
create table public.server_members (
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (server_id, user_id)
);
alter table public.server_members enable row level security;
create policy "members viewable by all auth" on public.server_members for select to authenticated using (true);
create policy "users join servers" on public.server_members for insert to authenticated with check (auth.uid() = user_id);
create policy "users leave servers" on public.server_members for delete to authenticated using (auth.uid() = user_id);

-- POSTS
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  server_id uuid references public.servers(id) on delete set null,
  caption text,
  media_url text,
  media_type text,
  ipfs_hash text,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create policy "posts viewable by all auth" on public.posts for select to authenticated using (true);
create policy "users create own posts" on public.posts for insert to authenticated with check (auth.uid() = user_id);
create policy "users delete own posts" on public.posts for delete to authenticated using (auth.uid() = user_id);
create policy "server admin deletes posts" on public.posts for delete to authenticated using (
  server_id is not null and exists(
    select 1 from public.servers s where s.id = posts.server_id and s.admin_id = auth.uid()
  )
);

-- LIKES
create table public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.likes enable row level security;
create policy "likes viewable" on public.likes for select to authenticated using (true);
create policy "users like" on public.likes for insert to authenticated with check (auth.uid() = user_id);
create policy "users unlike" on public.likes for delete to authenticated using (auth.uid() = user_id);

-- COMMENTS
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;
create policy "comments viewable" on public.comments for select to authenticated using (true);
create policy "users comment" on public.comments for insert to authenticated with check (auth.uid() = user_id);
create policy "users delete own comments" on public.comments for delete to authenticated using (auth.uid() = user_id);

-- RULE VOTES
create table public.rule_votes (
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vote int not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (server_id, user_id)
);
alter table public.rule_votes enable row level security;
create policy "votes viewable" on public.rule_votes for select to authenticated using (true);
create policy "users vote" on public.rule_votes for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own vote" on public.rule_votes for update to authenticated using (auth.uid() = user_id);
create policy "users delete own vote" on public.rule_votes for delete to authenticated using (auth.uid() = user_id);

-- STORAGE bucket for media
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media public read" on storage.objects for select using (bucket_id = 'media');
create policy "media auth upload" on storage.objects for insert to authenticated with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media auth delete own" on storage.objects for delete to authenticated using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
