---
name: Plan features translation
description: subscription_plans.features stored in FR canonical, translated to EN at render via translateFeature() helper
type: feature
---
Les `features` des plans sont stockés en français dans la table `subscription_plans` (langue canonique côté admin). À l'affichage, on les traduit côté client via `translateFeature(feature, locale)` ou `translateFeatures(features, locale)` depuis `src/lib/planFeatures.ts` qui contient un dictionnaire FR→EN.

Sites de rendu à toujours wrapper :
- `src/components/landing/PricingSection.tsx` (planCards.features)
- `src/pages/dashboard/PaymentPage.tsx` (carte plan actif, plans grid, FeatureComparisonTable)
- `src/pages/OnboardingPage.tsx` (sélection de plan)

Quand un admin ajoute une nouvelle feature dans la DB, l'ajouter au dictionnaire `FEATURE_DICTIONARY` ; sinon le helper retourne la chaîne FR telle quelle (fallback safe).