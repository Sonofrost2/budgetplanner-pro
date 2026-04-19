

## Constat — Anomalies entre Plans définis et Code

### Plans en base
| Plan | Annonces marketing |
|---|---|
| **Free** | 15 tx/mois · 1 compte · 1 budget · 5 catégories · Dashboard basique |
| **Pro** | Illimité tx/comptes/budgets/catégories · Rapports mensuels · Notifications intelligentes |
| **Premium** | Tout Pro + Prévisions IA · Famille · Exports PDF/Excel · Scan reçus · Support 24/7 · Multi-devises |

### Anomalies détectées

**1. Limites quantitatives appliquées seulement sur 4 modules (Tx, Comptes, Budgets) — Catégories oubliées**
- `useSubscription.limits.categories = 5` existe pour Free, mais **aucun garde-fou** dans `CategoriesPage.tsx`. Free peut créer 80 catégories.

**2. `canUseAISuggestions = isPaid`** → le **Pro** y a accès, mais **Premium-only** dans le marketing (`Prévisions IA avancées`, `Scan de reçus`). Inversement, fonctions IA appelées sans garde-fou serveur :
- `ai-quick-parse` (Hero Transactions) → ouvert à tous, **devrait être Pro+**
- `ai-detect-recurring` (RecurringPage) → ouvert à tous
- `ai-savings-simulate`, `ai-budget-suggest`, `ai-debt-plan`, `ai-wealth-valuation`, `ai-report-insights` → aucun check côté UI ni Edge Function
- `ai-chat` (widget global) → ouvert à tous

**3. Scan de reçus (Receipts)** annoncé Premium-only → pas de gating UI/serveur dans `ReceiptsPage.tsx` ni `ReceiptUpload.tsx`.

**4. Wealth / Debts / Recurring** → aucun gating, alors qu'on pourrait considérer Recurring + Wealth comme Pro+ (à confirmer).

**5. Rapports mensuels (Pro) vs Rapports avancés (Premium)** → seul `canExportAdvanced = isPaid` existe → Pro a accès aux exports avancés alors que c'est annoncé Premium uniquement.

**6. Pas de gating côté Edge Functions** → un utilisateur Free peut appeler n'importe quelle fonction IA via la console. Risque d'abus de coûts LOVABLE_API_KEY.

**7. Pas d'environnement de test** : impossible de simuler facilement Free / Pro / Premium pour QA. Aujourd'hui il faut éditer la table `subscriptions` à la main.

---

## Plan d'action

### Étape 1 — Définir la matrice officielle (à valider)
Matrice cible (basée sur le marketing actuel) :

| Capacité | Free | Pro | Premium |
|---|:-:|:-:|:-:|
| Transactions/mois | 15 | ∞ | ∞ |
| Comptes / Budgets / Catégories | 1/1/5 | ∞ | ∞ |
| Tableau de bord complet | basique | ✅ | ✅ |
| Notifications intelligentes (push/email) | ❌ | ✅ | ✅ |
| Récurrences | ❌ | ✅ | ✅ |
| IA basique (catégorisation, suggest, quick-parse) | ❌ | ✅ | ✅ |
| Exports CSV simple | ✅ | ✅ | ✅ |
| **Exports PDF/Excel avancés** | ❌ | ❌ | ✅ |
| **Prévisions IA (Forecasts, ai-budget-suggest, ai-debt-plan, ai-savings-simulate, ai-report-insights, ai-detect-recurring)** | ❌ | ❌ | ✅ |
| **Scan de reçus (OCR + storage)** | ❌ | ❌ | ✅ |
| **Wealth (patrimoine + valuation IA)** | ❌ | ❌ | ✅ |
| **Famille** | ❌ | ❌ | ✅ |
| **AI Chat (Coach)** | ❌ | ✅ (limité) | ✅ (illimité) |
| Multi-devises avancé | ❌ | ❌ | ✅ |

### Étape 2 — Refondre `useSubscription.tsx`
Ajouter capabilities granulaires :
```ts
canUseRecurring, canUseAIBasic, canUseAIPremium,
canUseReceipts, canUseWealth, canUseFamily, canUseForecast,
canExportAdvanced, canUseChatCoach, limits.categories applied
```

### Étape 3 — Appliquer le gating UI manquant
- `CategoriesPage` : `categoryLimitReached` + `UpgradeBanner` + toast
- `ReceiptsPage` + `ReceiptUpload` : gate Premium + UpgradeBanner
- `WealthPage` : gate Premium + UpgradeBanner
- `RecurringPage` : gate Pro+ + bouton AI detect → Premium
- Tous les boutons IA (✨ Sparkles) : afficher Lock + tooltip "Plan Premium" si non éligible
- `ReportsPage` : exports PDF/Excel Premium-only (CSV reste Pro+)

### Étape 4 — Sécurité serveur (Edge Functions)
Helper `requirePlan(supabase, userId, ['pro','premium'])` à appeler en début de chaque Edge Function IA. Retourne 403 si plan insuffisant. À ajouter sur :
`ai-suggest`, `ai-categorize`, `ai-quick-parse`, `ai-chat`, `ai-budget-suggest`, `ai-debt-plan`, `ai-detect-recurring`, `ai-forecast`, `ai-report-insights`, `ai-savings-simulate`, `ai-wealth-valuation`.

### Étape 5 — Outil de test "Plan Switcher" (DEV only, admin only)
Ajouter dans `SettingsPage` (section Sécurité) une carte **"Tester comme…"** visible uniquement si `useRole().isAdmin`. 3 boutons : Free / Pro / Premium → upsert dans `subscriptions` avec `plan_id` correspondant + invalidate query. Logout/login non requis.

### Étape 6 — Matrice de QA end-to-end
Pour chaque plan, vérifier via le Plan Switcher :
- **Free** : limites 15/1/1/5 bloquantes, badges Lock partout, IA refusée, Family/Wealth/Receipts/Forecasts/Recurring inaccessibles
- **Pro** : tout illimité, IA basique OK, Recurring OK, mais Forecasts/Family/Wealth/Receipts/Exports PDF bloqués
- **Premium** : tout débloqué

---

## Fichiers impactés (estimation)

**Hook & Helpers** (2)
- `src/hooks/useSubscription.tsx` (refonte capabilities)
- `supabase/functions/_shared/requirePlan.ts` (nouveau — réutilisé par toutes les fns IA)

**Pages avec gating à ajouter** (6)
- `CategoriesPage.tsx`, `ReceiptsPage.tsx`, `WealthPage.tsx`, `RecurringPage.tsx`, `ReportsPage.tsx` (split CSV/PDF), `SettingsPage.tsx` (Plan Switcher admin)

**Composants IA à protéger** (4)
- `TransactionForm.tsx` (déjà OK), `TransactionsHeroHeader.tsx` (quick-parse), `AIChatWidget.tsx`, `BudgetForm.tsx`

**Edge Functions à durcir** (~11) — ajout du check `requirePlan`

**i18n** : ajouter `upgradeCategories`, `upgradeReceipts`, `upgradeWealth`, `upgradeRecurring`, `upgradeAIPremium`, `limitCategoriesReached/Toast`

---

## Question rapide avant d'implémenter

La **matrice cible ci-dessus** te convient-elle, ou veux-tu déplacer certaines capacités ?
- Notamment : **AI Chat** → Pro ou Premium ? **Wealth** → Pro ou Premium ? **Recurring** → Free ou Pro ?

Réponds par la matrice validée (ou "OK matrice par défaut") et j'enchaîne directement sur l'implémentation complète + le Plan Switcher de test.

