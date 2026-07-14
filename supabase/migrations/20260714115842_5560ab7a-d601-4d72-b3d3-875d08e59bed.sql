CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_last_payment_token_key
ON public.subscriptions (user_id, last_payment_token)
WHERE last_payment_token IS NOT NULL;