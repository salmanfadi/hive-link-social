-- Federated Server System & Moderation Layer
-- Step 5 & 6: Enhanced server features + moderation

-- Add server federation fields
alter table public.servers add column if not exists federation_enabled boolean default false;
alter table public.servers add column if not exists federation_url text;
alter table public.servers add column if not exists server_public_key text;

-- Add server moderation settings
alter table public.servers add column if not exists moderation_level text default 'open' check (moderation_level in ('open', 'moderate', 'strict'));
alter table public.servers add column if not exists auto_approve_members boolean default true;

-- MODERATION: Hidden posts (soft delete from server view, not global)
create table if not exists public.server_hidden_posts (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  moderator_id uuid not null references public.profiles(id),
  reason text,
  hidden_at timestamptz not null default now(),
  unique(server_id, post_id)
);

-- User blocks (block content/creators)
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique(blocker_id, blocked_id)
);

-- Server member roles
alter table public.server_members add column if not exists role text default 'member' check (role in ('member', 'moderator', 'admin'));
alter table public.server_members add column if not exists muted_until timestamptz;

-- GOVERNANCE: Proposals
create table if not exists public.server_proposals (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  title text not null,
  description text not null,
  proposal_type text not null check (proposal_type in ('rule_change', 'moderator_add', 'moderator_remove', 'server_settings', 'federation')),
  status text default 'active' check (status in ('active', 'passed', 'rejected', 'expired')),
  votes_for integer default 0,
  votes_against integer default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Proposal votes
create table if not exists public.proposal_votes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.server_proposals(id) on delete cascade,
  voter_id uuid not null references public.profiles(id),
  vote boolean not null,
  created_at timestamptz not null default now(),
  unique(proposal_id, voter_id)
);

-- RLS policies for new tables
alter table public.server_hidden_posts enable row level security;
alter table public.user_blocks enable row level security;
alter table public.server_proposals enable row level security;
alter table public.proposal_votes enable row level security;

-- Server hidden posts: visible to server mods/admins
create policy "server mods view hidden posts" on public.server_hidden_posts for select to authenticated using (
  exists(select 1 from public.server_members where server_id = server_hidden_posts.server_id and user_id = auth.uid() and role in ('moderator', 'admin'))
);

-- User blocks: only visible to blocker
create policy "users view own blocks" on public.user_blocks for select to authenticated using (auth.uid() = blocker_id);
create policy "users create blocks" on public.user_blocks for insert to authenticated with check (auth.uid() = blocker_id);
create policy "users delete own blocks" on public.user_blocks for delete to authenticated using (auth.uid() = blocker_id);

-- Proposals: visible to server members
create policy "server members view proposals" on public.server_proposals for select to authenticated using (
  exists(select 1 from public.server_members where server_id = server_proposals.server_id and user_id = auth.uid())
);
create policy "server members create proposals" on public.server_proposals for insert to authenticated with check (
  exists(select 1 from public.server_members where server_id = server_proposals.server_id and user_id = auth.uid())
);

-- Votes: visible to server members
create policy "server members view votes" on public.proposal_votes for select to authenticated using (
  exists(select 1 from public.server_members sm 
    join public.server_proposals p on p.server_id = sm.server_id 
    where p.id = proposal_votes.proposal_id and sm.user_id = auth.uid())
);
create policy "server members vote" on public.proposal_votes for insert to authenticated with check (
  exists(select 1 from public.server_members sm 
    join public.server_proposals p on p.server_id = sm.server_id 
    where p.id = proposal_votes.proposal_id and sm.user_id = auth.uid())
);

-- Indexes for performance
create index if not exists idx_posts_server_created on public.posts(server_id, created_at desc);
create index if not exists idx_server_members_user on public.server_members(user_id, server_id);
create index if not exists idx_proposals_server on public.server_proposals(server_id, created_at desc);
create index if not exists idx_proposal_votes_proposal on public.proposal_votes(proposal_id);