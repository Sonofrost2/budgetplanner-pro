
-- Explicitly deny INSERT on user_roles for all authenticated users
CREATE POLICY "Deny role self-assignment" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- Explicitly deny UPDATE on user_roles for all authenticated users
CREATE POLICY "Deny role updates" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (false);

-- Explicitly deny DELETE on user_roles for all authenticated users
CREATE POLICY "Deny role deletion" ON public.user_roles
  FOR DELETE TO authenticated
  USING (false);
