
-- Update the function to use the anon key (public, safe to embed)
CREATE OR REPLACE FUNCTION public.notify_on_transaction_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Call edge function asynchronously via pg_net using anon key
  PERFORM net.http_post(
    url := 'https://sfcwoftgzxplbexcmzva.supabase.co/functions/v1/notify-transaction',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY3dvZnRnenhwbGJleGNtenZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MjM5OTYsImV4cCI6MjA4ODQ5OTk5Nn0.PRMjJgY1JDygvq-r5QDAugGZed3eEvS_Ie9wD3B1_qE',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY3dvZnRnenhwbGJleGNtenZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MjM5OTYsImV4cCI6MjA4ODQ5OTk5Nn0.PRMjJgY1JDygvq-r5QDAugGZed3eEvS_Ie9wD3B1_qE'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'amount', NEW.amount,
      'type', NEW.type,
      'description', NEW.description,
      'account_id', NEW.account_id
    )
  );

  RETURN NEW;
END;
$$;
