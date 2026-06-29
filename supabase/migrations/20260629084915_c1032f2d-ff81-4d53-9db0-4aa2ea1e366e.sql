-- 1. Realtime: scope SELECT on realtime.messages to known app topics only
DROP POLICY IF EXISTS "Authenticated can receive realtime messages" ON realtime.messages;

CREATE POLICY "Authenticated can receive scoped realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() = 'attendance-realtime')
  OR (realtime.topic() LIKE 'predictions-%')
);

-- 2. Storage: add UPDATE policy for admins on team-history bucket (mirror INSERT/DELETE)
DROP POLICY IF EXISTS "Admins can update team-history" ON storage.objects;
CREATE POLICY "Admins can update team-history"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'team-history' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'team-history' AND has_role(auth.uid(), 'admin'::app_role));
