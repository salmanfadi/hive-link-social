-- Add IPFS upload status tracking columns to posts table.
-- ipfs_pinned: true = successfully pinned to Pinata/IPFS
-- ipfs_failed_reason: non-null = last pin failure message (enables retry UI)

alter table public.posts
  add column if not exists ipfs_pinned boolean not null default false,
  add column if not exists ipfs_failed_reason text;

-- Index to efficiently find posts that need IPFS retry
create index if not exists posts_ipfs_retry_idx
  on public.posts (user_id)
  where ipfs_pinned = false and media_url is not null;
