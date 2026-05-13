
REVOKE EXECUTE ON FUNCTION public.debit_message() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.on_admin_role_grant() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.gen_booking_code() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.create_match_if_mutual() FROM PUBLIC, authenticated, anon;
