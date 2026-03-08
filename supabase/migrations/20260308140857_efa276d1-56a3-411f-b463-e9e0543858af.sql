CREATE POLICY "Admins can read all plans" ON public.subscription_plans
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));