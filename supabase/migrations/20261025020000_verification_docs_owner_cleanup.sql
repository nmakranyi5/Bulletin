-- You can see and delete your own pending verification files (needed to clean them up when
-- you delete your account). Reviewers keep their existing read/delete access.
drop policy if exists "verification-docs: owner can read own" on storage.objects;
create policy "verification-docs: owner can read own"
  on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "verification-docs: owner can delete own" on storage.objects;
create policy "verification-docs: owner can delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);
