-- Buckets are private. No browser Storage policies are created deliberately.
-- A trusted API must authorize each upload/download, validate file bytes,
-- audit access and issue a short-lived signed URL. Never expose its secret key.
begin;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('oral-images', 'oral-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('pathology-reports', 'pathology-reports', false, 10485760, array['application/pdf']);
commit;
