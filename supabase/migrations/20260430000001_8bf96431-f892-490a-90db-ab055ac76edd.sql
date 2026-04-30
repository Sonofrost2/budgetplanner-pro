-- Hardening: revoke EXECUTE from anon on sensitive SECURITY DEFINER functions
-- accept_family_invitation stays open (public invitation link flow)

-- Admin functions (only authenticated admins should call)
REVOKE EXECUTE ON FUNCTION public.admin_get_user_snapshot(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_users(uuid, text, text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_log_action(uuid, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_plan(uuid, uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_suspicious_ips(uuid) FROM anon;

-- Transfer / financial mutations
REVOKE EXECUTE ON FUNCTION public.perform_transfer(uuid, uuid, uuid, numeric, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_transfer(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_transfer(uuid, uuid, numeric, text, uuid, uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_account_balance(uuid) FROM anon;

-- Category management
REVOKE EXECUTE ON FUNCTION public.bulk_reparent_categories(uuid, uuid[], uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_categories(uuid, uuid[], uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_user_family_root(uuid) FROM anon;

-- Family management
REVOKE EXECUTE ON FUNCTION public.delete_family_group_cascade(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.leave_family_group(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.transfer_family_ownership(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_family_dashboard(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_family_member_profiles(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_family_transactions(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_family_admin(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_family_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_family_owner(uuid, uuid) FROM anon;

-- Per-user data access
REVOKE EXECUTE ON FUNCTION public.get_account_drilldown(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_account_theoretical_balances(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_budget_spending(uuid, uuid, text, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_budgets_spending(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_category_analytics(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dormant_accounts(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.compute_health_score(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_demo_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_subscription_valid(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_usage(uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_pending_alerts(uuid, text[], text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.should_send_notification(uuid, text, text, integer) FROM anon;

-- Admin metrics / logs
REVOKE EXECUTE ON FUNCTION public.get_notification_metrics(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(uuid, uuid, text, text, text, text, jsonb, text, text, text) FROM anon;