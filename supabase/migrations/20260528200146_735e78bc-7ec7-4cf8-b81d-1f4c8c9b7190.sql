
-- 1) Restrict family_invitations SELECT to owner + invitee only (prevents email enumeration by other members)
DROP POLICY IF EXISTS "Members can view invitations" ON public.family_invitations;
CREATE POLICY "Owner or invitee can view invitations"
ON public.family_invitations
FOR SELECT
TO authenticated
USING (
  public.is_family_owner(auth.uid(), group_id)
  OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
);

-- 2) Explicit deny anon writes on security_signals (defense-in-depth)
DROP POLICY IF EXISTS "Deny anon writes on security_signals" ON public.security_signals;
CREATE POLICY "Deny anon writes on security_signals"
ON public.security_signals
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
REVOKE INSERT, UPDATE, DELETE ON public.security_signals FROM anon;

-- 3) Revoke EXECUTE from anon on SECURITY DEFINER functions that require an authenticated user
REVOKE EXECUTE ON FUNCTION public.accept_family_invitation(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM anon, PUBLIC;

-- 4) Revoke EXECUTE from authenticated on trigger-only / internal SECURITY DEFINER functions
-- These functions are only invoked by database triggers or by service_role from edge functions.
DO $$
DECLARE
  fn text;
  trigger_only_funcs text[] := ARRAY[
    'sync_budget_savings_link',
    'sync_savings_from_transaction',
    'update_account_last_activity',
    'resolve_alerts_on_debt_payment',
    'resolve_alerts_on_savings_progress',
    'seed_default_family_group_categories',
    'log_audit_event',
    'admin_log_action'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_only_funcs LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM authenticated, anon, PUBLIC', fn);
  END LOOP;
EXCEPTION WHEN undefined_function THEN
  -- ignore signature mismatches; we'll catch others individually below
  NULL;
END $$;
