-- Resumes live in a private "resumes" bucket. The app opens them with short-lived signed
-- links, so only the owner and recruiters can read one; the old public links stop working.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do update set public = false;

-- You manage files in your own folder ("<your user id>/resume.pdf").
drop policy if exists "resumes: owner can write" on storage.objects;
create policy "resumes: owner can write"
  on storage.objects for all to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

-- Recruiters can read any resume (so they can view candidates').
drop policy if exists "resumes: recruiters can read" on storage.objects;
create policy "resumes: recruiters can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'resumes'
    and exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_recruiter
    )
  );
