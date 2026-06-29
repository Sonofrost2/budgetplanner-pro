UPDATE public.subscription_plans
SET currency_prices = currency_prices
  || jsonb_build_object('NGN', 45000, 'GHS', 360, 'KES', 3990, 'ZAR', 549)
WHERE name = 'premium';