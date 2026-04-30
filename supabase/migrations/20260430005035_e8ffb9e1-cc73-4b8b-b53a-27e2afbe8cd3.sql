-- 1) family_invitations: remove the over-permissive public-by-token policy.
-- The accept_family_invitation(token) SECURITY DEFINER function already
-- handles the unauthenticated acceptance flow safely.
DROP POLICY IF EXISTS "Public can view invitation by token" ON public.family_invitations;

-- Keep the existing "Members can view invitations" policy (members + invitee by email)
-- which already covers legitimate read access for authenticated users.

-- 2) message_template_overrides: restrict SELECT to admins only.
DROP POLICY IF EXISTS "Authenticated can read sms templates" ON public.message_template_overrides;

CREATE POLICY "Admins can read message templates"
ON public.message_template_overrides
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
