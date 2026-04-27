REVOKE EXECUTE ON FUNCTION public.get_notification_metrics(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_notification_metrics(integer) TO authenticated;