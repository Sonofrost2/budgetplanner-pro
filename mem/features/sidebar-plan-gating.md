---
name: Sidebar plan gating
description: AppSidebar uses item.requiredPlan ('pro'|'premium'); locked items render greyed with badge + Lock icon and open AlertDialog confirming redirect to /dashboard/payment instead of navigating
type: feature
---
Modules réservés (configuré dans `src/components/dashboard/AppSidebar.tsx`) :
- **Pro** : recurring, debts, budgetSavingsLinks, reports
- **Premium** : receipts, wealth, forecasts, family

Les items verrouillés affichent : icône grisée + label muted + petit badge `Pro`/`Premium` avec cadenas. Au clic, ouverture d'un `AlertDialog` qui demande confirmation avant redirection vers `/dashboard/payment`. L'admin contourne tous les gating (rank=premium).

Ne jamais ajouter un nouveau module payant sans définir `requiredPlan` sur le `NavItem` correspondant.
