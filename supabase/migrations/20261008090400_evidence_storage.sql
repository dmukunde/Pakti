-- Pakti V1 · Migration 5 of 5 · Private evidence storage
--
-- Bucket `evidence` is private. Objects live at {user_id}/{log_id}/{file}.
-- Only the owner can read, write or delete objects in their own folder, and
-- only under a log they own. There is no partner path and no public URL;
-- the owner views files through short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence',
  'evidence',
  false,
  5242880,  -- 5 MB, matches public.evidence.size_bytes
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "evidence files: owner reads own folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "evidence files: owner uploads under own log"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.activity_logs l
      where l.id::text = (storage.foldername(name))[2]
        and l.user_id = (select auth.uid())
    )
  );

create policy "evidence files: owner replaces own files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "evidence files: owner deletes own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
