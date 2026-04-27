REVOKE EXECUTE ON FUNCTION public.reset_demo_account() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_demo_user_id() FROM public, anon, authenticated;
-- is_demo_user stays callable by authenticated users
REVOKE EXECUTE ON FUNCTION public.is_demo_user(uuid) FROM public, anon;