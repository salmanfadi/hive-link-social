-- Add signature column to posts for authorship verification
alter table public.posts add column signature text;

comment on column public.posts.signature is 'Ed25519 signature of the post content (caption + media_url + created_at)';
