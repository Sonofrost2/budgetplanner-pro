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
  'Récurrents automatiques': 'Automatic recurring transactions',
  'IA basique (catégorisation, suggestions)': 'Basic AI (categorization, suggestions)',
  'Coach IA par chat': 'AI coach chat',

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
  const trimmed = feature.trim();
  if (FEATURE_DICTIONARY[trimmed]) return FEATURE_DICTIONARY[trimmed];

  // Pattern-based fallbacks so admin-edited numbers keep translating.
  // Examples handled: "20 transactions/mois", "3 comptes", "10 budgets",
  // "8 catégories", "5 jours d'essai gratuit".
  const patterns: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
    [/^(\d+)\s+transactions?\/mois$/i, (m) => `${m[1]} transactions/month`],
    [/^(\d+)\s+comptes?$/i, (m) => `${m[1]} account${m[1] === '1' ? '' : 's'}`],
    [/^(\d+)\s+budgets?$/i, (m) => `${m[1]} budget${m[1] === '1' ? '' : 's'}`],
    [/^(\d+)\s+catégories?$/i, (m) => `${m[1]} categor${m[1] === '1' ? 'y' : 'ies'}`],
    [/^(\d+)\s+jours?\s+d['']essai\s+gratuit$/i, (m) => `${m[1]}-day free trial`],
    [/^(\d+)\s+objectifs?\s+d['']épargne$/i, (m) => `${m[1]} savings goal${m[1] === '1' ? '' : 's'}`],
  ];
  for (const [re, fn] of patterns) {
    const m = trimmed.match(re);
    if (m) return fn(m);
  }

  return feature;
};

/** Convenience: map an array of features. */
export const translateFeatures = (features: string[], locale: string): string[] =>
  features.map((f) => translateFeature(f, locale));