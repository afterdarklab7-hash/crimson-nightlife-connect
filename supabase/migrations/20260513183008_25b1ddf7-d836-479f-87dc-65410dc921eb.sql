
-- Pin search_path on remaining functions
ALTER FUNCTION public.enforce_age_gate() SET search_path = public;
ALTER FUNCTION public.distance_km(double precision, double precision, double precision, double precision) SET search_path = public;

-- Restrict EXECUTE on SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_match_if_mutual() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_age_gate() FROM PUBLIC, anon, authenticated;

-- Tighten public-bucket listing: replace blanket SELECT with object-level read.
-- Files remain accessible by their public URL; clients just can't list/enumerate the bucket.
DROP POLICY IF EXISTS "profile_photos_public_read" ON storage.objects;
-- (No replacement needed: signed/public URLs serve files directly without a SELECT policy.)
