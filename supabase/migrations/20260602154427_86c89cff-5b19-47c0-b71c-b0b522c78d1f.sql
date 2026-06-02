-- 1. Realtime: require authenticated to receive any postgres_changes messages
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can receive realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

-- 2. Lock down SECURITY DEFINER functions: revoke broad EXECUTE
-- Trigger-only functions: revoke from anon + authenticated (only postgres/triggers call them)
REVOKE EXECUTE ON FUNCTION public.auto_assign_admin() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;

-- has_role: required by RLS policies for authenticated users; revoke from anon only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- add_admin_by_email: admin-only; keep authenticated (internal check enforces admin), revoke anon
REVOKE EXECUTE ON FUNCTION public.add_admin_by_email(text) FROM anon, PUBLIC;

-- 3. Public buckets: restrict object LISTING (SELECT) to authenticated users.
-- Direct file URLs continue to work via the public CDN regardless of RLS.
DROP POLICY IF EXISTS "Anyone can read player images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read team-history" ON storage.objects;

CREATE POLICY "Authenticated can list player images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'player-images');

CREATE POLICY "Authenticated can list team-history"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'team-history');