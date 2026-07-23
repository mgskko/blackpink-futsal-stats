CREATE POLICY "Admins can read player and team-history images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id IN ('player-images','team-history')
  AND public.has_role(auth.uid(), 'admin')
);