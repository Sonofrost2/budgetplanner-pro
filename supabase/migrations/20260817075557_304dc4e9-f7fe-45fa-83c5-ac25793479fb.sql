UPDATE public.subscriptions
SET status = 'active',
    canceled_at = NULL,
    current_period_start = now(),
    current_period_end = '2099-12-31 23:59:59+00',
    updated_at = now()
WHERE id = 'aba0ee64-3ff3-4473-9b8e-2ac3c15a338c';