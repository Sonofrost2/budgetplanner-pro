
-- Update free plan with coherent prices and features
UPDATE subscription_plans SET
  base_price = 0,
  currency_prices = '{"EUR": 0, "USD": 0, "GBP": 0, "CAD": 0, "CHF": 0, "XOF": 0, "XAF": 0}'::jsonb,
  features = '["15 transactions/mois", "1 compte", "1 budget", "Tableau de bord basique", "5 catégories"]'::jsonb,
  trial_days = 0
WHERE name = 'free';

-- Update premium plan with coherent, competitive prices
UPDATE subscription_plans SET
  base_price = 4.99,
  currency_prices = '{"EUR": 4.99, "USD": 4.99, "GBP": 3.99, "CAD": 6.99, "CHF": 4.99, "XOF": 2990, "XAF": 2990}'::jsonb,
  features = '["Transactions illimitées", "Comptes illimités", "Budgets illimités", "Catégories illimitées", "Prévisions IA", "Rapports avancés & exports", "Gestion familiale", "Objectifs d''épargne", "Support prioritaire"]'::jsonb,
  trial_days = 14
WHERE name = 'premium';
