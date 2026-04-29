
-- Restrict media bucket listing
drop policy if exists "media public read" on storage.objects;
create policy "media auth read" on storage.objects for select to authenticated using (bucket_id = 'media');

-- Lock down handle_new_user execution (trigger still works as it runs as table owner)
revoke execute on function public.handle_new_user() from anon, authenticated, public;
