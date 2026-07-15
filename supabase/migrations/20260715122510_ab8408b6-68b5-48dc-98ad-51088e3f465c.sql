
REVOKE ALL ON FUNCTION public.auto_complete_savings_goal() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.capitalize_savings_interest() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_savings_contribution(uuid, uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.renew_savings_goals() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rollover_once_budgets(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_from_goal(uuid, numeric, uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_savings_contribution(uuid, uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_from_goal(uuid, numeric, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.capitalize_savings_interest() TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_savings_goals() TO service_role;
GRANT EXECUTE ON FUNCTION public.rollover_once_budgets(uuid) TO service_role;
