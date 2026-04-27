/**
 * Plan features stored in `subscription_plans.features` are written in French
 * (the canonical authoring language). On the public landing page we localize
 * them on the fly so EN visitors see English bullets.
 *
 * If a feature is missing from the dictionary we return it unchanged — keeps
 * the page working even when admins add new strings before translation.
 */
const FEATURE_DICTIONARY: Record<string, string> = {
  // Free plan
  '15 transactions/mois': '15 transactions/month',
  '1 compte': '1 account',
  '1 budget': '1 budget',
  '5 catégories': '5 categories',
  'Tableau de bord basique': 'Basic dashboard',

  // Pro plan
  'Transactions illimitées': 'Unlimited transactions',
  'Comptes illimités': 'Unlimited accounts',
  'Budgets illimités': 'Unlimited budgets',
  'Catégories illimitées': 'Unlimited categories',
  'Rapports mensuels': 'Monthly reports',
  'Tableau de bord complet': 'Full dashboard',
  'Notifications intelligentes': 'Smart notifications',

  // Premium plan
  'Tout du plan Pro': 'Everything in Pro',
  'Prévisions IA avancées': 'Advanced AI forecasts',
  'Gestion familiale complète': 'Full family management',
  "Objectifs d'épargne illimités": 'Unlimited savings goals',
  'Rapports avancés & exports PDF/Excel': 'Advanced reports & PDF/Excel exports',
  'Support prioritaire 24/7': 'Priority 24/7 support',
  'Scan de reçus': 'Receipt scanning',
  'Multi-devises avancé': 'Advanced multi-currency',
};

/**
 * Translate a single feature string to the active locale.
 * Falls back gracefully (returns the original) for unknown entries.
 */
export const translateFeature = (feature: string, locale: string): string => {
  if (locale === 'fr') return feature;
  return FEATURE_DICTIONARY[feature.trim()] || feature;
};

/** Convenience: map an array of features. */
export const translateFeatures = (features: string[], locale: string): string[] =>
  features.map((f) => translateFeature(f, locale));