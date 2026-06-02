-- Drop broad SELECT policies on public buckets entirely.
-- The buckets remain public for CDN URL access (getPublicUrl), but the
-- storage.objects listing API is no longer exposed.
DROP POLICY IF EXISTS "Authenticated can list player images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can list team-history" ON storage.objects;