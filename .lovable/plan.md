

# Plan : Alertes intelligentes, Projections améliorées, Recherche globale et Cartes cliquables

---

## 1. Refonte des alertes et notifications — Approche "coach bienveillant"

### Philosophie
Remplacer les alertes alarmistes par un système de **coaching financier** avec 3 tons :
- **Félicitations** (success) : économies réalisées, budget sous contrôle
- **Rappels proactifs** (info) : échéances imminentes, cotisations à venir  
- **Alertes ciblées** (warning/critical) : dépassements avec explication et conseil

### Nouveaux types de notifications

| Type | Ton | Exemple |
|---|---|---|
| `budget_savings` | 🎉 Success | "Bravo ! Vous avez économisé 15 000 sur Alimentation cette semaine" |
| `budget_upcoming` | 📅 Info | "Loyer prévu dans 3 jours (150 000 FCFA)" |
| `savings_upcoming` | 🐷 Info | "Cotisation épargne Vacances prévue dans 5 jours" |
| `budget_exceeded` | ⚠️ Warning | "Alimentation dépassé de 12% — 3 achats hors budget identifiés" |
| `balance_discrepancy` | 🔍 Warning | "Écart de 5 200 sur Compte Orange — vérifiez vos transactions" |
| `recurring_upcoming` | 📋 Info | "Abonnement Netflix prévu demain (6 500 FCFA)" |
| `week_summary` | 📊 Info | "Bilan semaine : 85% budget utilisé, 12 000 économisés" |

### Fichier modifié : `NotificationBell.tsx`
- Ajouter les types `budget_savings`, `budget_upcoming`, `savings_upcoming`, `balance_discrepancy`, `recurring_upcoming`, `week_summary`
- Requêter `recurring_transactions` (where `active = true` and `next_date` dans les 7 prochains jours)
- Requêter `payment_accounts` pour comparer `real_balance` vs `opening_balance + SUM(transactions)`
- Calculer les économies hebdomadaires (budget - dépensé quand positif)
- Identifier les dépenses imminentes via `expected_day` et `reference_date` des budgets

### Fichier modifié : `check-alerts/index.ts` (Edge Function push)
- Aligner la logique push avec les mêmes nouveaux types
- Ajouter les rappels d'échéances (budgets avec `expected_day` proche)
- Ajouter les félicitations hebdomadaires (dimanche soir)

---

## 2. Amélioration des projections et du tempo budgétaire

### Problèmes actuels
- La projection dans `NotificationBell` est linéaire : `(spent / daysElapsed) * daysTotal` — ne tient pas compte de la fréquence, des jours actifs, ni du `expected_day`
- Les budgets non-mensuels sont mal gérés (le filtre de transactions est toujours mensuel)

### Corrections dans `NotificationBell.tsx`
- **Utiliser les vraies bornes de période** : calculer `periodStart`/`periodEnd` selon `budget.period` (déjà fait lignes 88-109) mais aussi filtrer les transactions sur ces bornes au lieu de `monthStart`/`monthEnd`
- **Projection alignée à la fréquence** : réutiliser la logique de `WeeklyPlannerWidget.computeWeeklyTarget` pour déterminer si une dépense est attendue dans la période restante
- **Tempo pondéré** : au lieu de `spent/daysElapsed * daysTotal`, calculer le rythme sur les 7 derniers jours et projeter : `(spent7days / 7) * daysRemaining + spentSoFar`
- **Projection avec deadline** : afficher "Dépassement estimé dans ~X jours" plutôt qu'un simple pourcentage
- **Budgets daily avec active_days** : diviser le montant par le nombre de jours actifs dans la période, pas par le nombre total de jours

### Détail technique
```text
Avant:  projection = (spent / daysElapsed) * daysTotal
Après:  
  1. txPeriod = transactions filtrées sur [periodStart, periodEnd] (pas monthStart)
  2. spent7 = dépenses des 7 derniers jours
  3. dailyRate = spent7 / min(7, daysElapsed)
  4. projection = spent + dailyRate * daysRemaining
  5. daysToExceed = (budget - spent) / dailyRate
  6. Message: "Dépassement estimé dans {daysToExceed}j"
```

---

## 3. Recherche globale — Command Palette (⌘K)

### Fichier créé : `GlobalSearchCommand.tsx`
- Utiliser les composants `Command`/`CommandDialog` existants (shadcn)
- Rechercher dans : Transactions, Comptes, Budgets, Catégories, Objectifs d'épargne, Pages de navigation
- Résultats groupés par module avec icônes
- Au clic : naviguer vers la page avec filtre/query activé

### Fichier modifié : `DashboardLayout.tsx`
- Remplacer le `<form>` + `<Input>` de recherche par le trigger du `CommandDialog`
- Conserver le raccourci ⌘K existant
- Le bouton de recherche ouvre le dialog au lieu de soumettre un formulaire

---

## 4. Cartes de statistiques cliquables

### `BudgetGlobalStats.tsx`
- Ajouter un prop `onCardClick?: (action: string) => void`
- Chaque carte reçoit `onClick` + `cursor-pointer` + hover effect
- Actions : `'evolution'`, `'consumed'`, `'analysis'`, `'alerts'`

### `SavingsGlobalStats.tsx`  
- Même pattern avec actions : `'evolution'`, `'locked'`, `'unlocked'`

### `StatsCards.tsx`
- Balance → naviguer vers `/dashboard/accounts`
- Stats secondaires → pages correspondantes

### Pages parentes (`BudgetsPage.tsx`, `SavingsPage.tsx`, `DashboardHome.tsx`)
- Gérer les callbacks `onCardClick` pour changer d'onglet ou activer des filtres

---

## Résumé des fichiers

| Fichier | Action |
|---|---|
| `src/components/dashboard/NotificationBell.tsx` | Refonte alertes + projections améliorées |
| `src/components/dashboard/GlobalSearchCommand.tsx` | **Créer** — Command palette multi-module |
| `src/components/dashboard/DashboardLayout.tsx` | Intégrer GlobalSearchCommand |
| `src/components/dashboard/budgets/BudgetGlobalStats.tsx` | Cartes cliquables |
| `src/components/dashboard/savings/SavingsGlobalStats.tsx` | Cartes cliquables |
| `src/components/dashboard/home/StatsCards.tsx` | Étendre clics stats secondaires |
| `src/pages/dashboard/BudgetsPage.tsx` | Gérer filtres via clic cartes |
| `src/pages/dashboard/SavingsPage.tsx` | Gérer filtres via clic cartes |
| `supabase/functions/check-alerts/index.ts` | Aligner push avec nouveaux types d'alertes |

