
-- Fix MISSING_WRITE_PROTECTION: explicitly deny client-side writes to notification_history
-- (inserts are done by edge functions using service_role key which bypasses RLS)
CREATE POLICY "Deny client inserts on notification_history"
  ON public.notification_history FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny client updates on notification_history"
  ON public.notification_history FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "Deny client deletes on notification_history"
  ON public.notification_history FOR DELETE
  TO authenticated
  USING (false);

-- Auto-cleanup function for notifications older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.notification_history
  WHERE sent_at < now() - interval '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
