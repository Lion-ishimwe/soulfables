-- =====================================================================
-- Soulfables — 0012 Storage buckets
--
-- Three buckets, and the split matters:
--
--   public-media   — covers, OG images, author portraits. Public by
--                    design; served through the CDN.
--   protected-media— narrated audio. Not public. Access depends on the
--                    story's access level and the listener's membership.
--   private-files  — every EPUB, PDF and downloadable asset a customer
--                    pays for. NEVER public. No policy grants direct
--                    select; the only route in is a signed URL minted by
--                    a server route after an entitlement check.
--
-- Brief §21: "No private files exposed through public URLs." That is
-- structural here, not a convention — there is no public bucket that a
-- paid file could be uploaded to by mistake.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-media', 'public-media', true, 10485760,
   array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml']),
  ('protected-media', 'protected-media', false, 524288000,
   array['audio/mpeg','audio/mp4','audio/aac','audio/ogg']),
  ('private-files', 'private-files', false, 209715200,
   array['application/pdf','application/epub+zip','application/octet-stream','application/zip'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- public-media: world-readable, staff-writable.
-- ---------------------------------------------------------------------
create policy "public media is readable"
  on storage.objects for select
  using (bucket_id = 'public-media');

create policy "staff upload public media"
  on storage.objects for insert
  with check (bucket_id = 'public-media' and is_staff());

create policy "staff manage public media"
  on storage.objects for update
  using (bucket_id = 'public-media' and is_staff());

create policy "staff delete public media"
  on storage.objects for delete
  using (bucket_id = 'public-media' and is_staff());

-- ---------------------------------------------------------------------
-- protected-media: staff write only. Reads happen through signed URLs
-- issued by the audio route, which checks story access first.
-- ---------------------------------------------------------------------
create policy "staff manage protected media"
  on storage.objects for all
  using (bucket_id = 'protected-media' and is_staff())
  with check (bucket_id = 'protected-media' and is_staff());

-- ---------------------------------------------------------------------
-- private-files: staff write only, and NO read policy for anyone.
--
-- This is intentional and worth stating plainly: even an authenticated
-- customer who owns the book cannot select the object directly. The
-- download route uses the service role to create a short-lived signed
-- URL, and only after has_entitlement() returns true. If that route has
-- a bug, the failure mode is a customer who cannot download — never a
-- stranger who can.
-- ---------------------------------------------------------------------
create policy "staff manage private files"
  on storage.objects for all
  using (bucket_id = 'private-files' and is_staff())
  with check (bucket_id = 'private-files' and is_staff());
