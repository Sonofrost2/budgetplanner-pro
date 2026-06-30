REVOKE EXECUTE ON FUNCTION public.admin_billing_kpis() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_payment_receipts(timestamptz, timestamptz, text, text, text, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_billing_kpis() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_payment_receipts(timestamptz, timestamptz, text, text, text, integer) TO authenticated, service_role;