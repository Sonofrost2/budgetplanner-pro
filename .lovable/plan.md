

# Plan : Cohérence des projections, alertes contextuelles, analyse budgétaire renforcée et filtres par période

## Problèmes identifiés

1. **Projections incohérentes** : `NotificationBell` utilise une moyenne pondérée 7j (`spent + dailyRate * daysRemaining`) tandis que `BudgetsPage` utilise un calcul linéaire simple (`(actual / daysElapsed) * daysTotal`). Le `BudgetAnalysisTab` ne calcule aucune projection.

2. **Alertes prématurées** : Les alertes "objectif non atteint" (contrôle `min`) se déclenchent dès 50% de la période sans tenir compte du `expected_day`. Si le budget prévoit un revenu le 25 du mois, l'alerte ne devrait pas se déclencher avant cette date.

3. **Analyse budgétaire limitée** : Le `BudgetAnalysisTab` ne montre que la période courante, sans projection, tempo, ni filtres de période.

4. **Pas de sélection de période** : Les modules Budget (onglet Analyse), Épargne (stats) et Comptes (stats) ne permettent pas de consulter les données sur des périodes passées.

---

## 1. Unifier le calcul de projection

**Créer `src/lib/budgetProjection.ts`** — fonction utilitaire partagée :
- `computeBudgetProjection(spent, daysElapsed, daysRemaining, spent7d, recentDays)` → `{ projection, dailyRate, daysToExceed }`
- `getBudgetPeriodBounds(period, now, referenceDate?)` (extraire de NotificationBell)

**Fichiers modifiés** :
- `NotificationBell.tsx` : importer depuis `budgetProjection.ts`
- `BudgetsPage.tsx` (renderBudgetCard, ligne 369) : remplacer `projection = (actual / daysElapsed) * daysTotal` par l'appel à la fonction partagée avec le même calcul 7j
- `BudgetAnalysisTab.tsx` : ajouter projection + tempo dans chaque carte budget

## 2. Alertes respectant les échéances budgétées

**Dans `NotificationBell.tsx`** — modifier la logique `controlType !== 'max'` (lignes 204-224) :
- Si `expected_day` existe et `now.getDate() < expected_day` → ne pas alerter "objectif non atteint"
- Si `expected_day` existe et `now.getDate() >= expected_day` et `spent < amount` → alerter
- Si pas de `expected_day` → garder le comportement actuel (>50% de la période)
- Même logique pour les budgets `max` avec `expected_day` : n'alerter "dépassement prévu" qu'après la date prévue

**Dans `check-alerts/index.ts`** : appliquer la même logique côté push.

## 3. Renforcer l'analyse budgétaire (`BudgetAnalysisTab`)

**Ajouter un sélecteur de période** (prédéfini + personnalisé) :
- Périodes : Mois en cours, Mois dernier, 3 mois, 6 mois, 1 an, Personnalisé
- Les bornes de période des budgets sont recalculées pour la période sélectionnée (ex: "mois dernier" → `periodStart` = 1er du mois passé)

**Ajouter des indicateurs enrichis par carte budget** :
- Projection (via la fonction partagée)
- Tempo (pace label : rapide/normal/lent)
- Économie ou dépassement estimé
- Jours restants dans la période

**Ajouter un résumé global** :
- Total budgété vs total consommé pour la période sélectionnée
- Économies totales / dépassements totaux
- Nombre de budgets en alerte / maîtrisés

## 4. Filtres par période dans les modules Épargne et Comptes

### `SavingsPage` — Stats globales filtrables
- Ajouter un sélecteur de période au-dessus des `SavingsGlobalStats`
- Recalculer : épargne consommée/ajoutée/progression sur la période sélectionnée
- Afficher les contributions de la période (pas seulement le cumul actuel)

### `AccountsPage` — Soldes historiques
- Ajouter un sélecteur de période dans l'onglet principal (pas seulement Recap)
- Permettre de voir le solde théorique à une date passée : `opening_balance + SUM(tx WHERE date <= period_end)`
- Afficher revenus/dépenses de la période sélectionnée par compte

### `BudgetsPage` — Onglet Manage avec période
- Ajouter un sélecteur de période dans l'onglet "Manage" pour voir les consommations des périodes passées
- Quand "Mois dernier" est sélectionné, recalculer les `budgetPeriodRanges` en décalant d'un mois

---

## Fichiers à modifier/créer

| Fichier | Action |
|---|---|
| `src/lib/budgetProjection.ts` | **Créer** — fonctions partagées projection + period bounds |
| `src/components/dashboard/NotificationBell.tsx` | Importer utils, fix alertes avec expected_day |
| `src/pages/dashboard/BudgetsPage.tsx` | Utiliser projection partagée, ajouter sélecteur période manage |
| `src/components/dashboard/tabs/BudgetAnalysisTab.tsx` | Refonte : sélecteur période, projection, tempo, résumé |
| `src/pages/dashboard/SavingsPage.tsx` | Sélecteur période pour stats globales |
| `src/components/dashboard/savings/SavingsGlobalStats.tsx` | Accepter période en props, recalculer |
| `src/pages/dashboard/AccountsPage.tsx` | Sélecteur période pour soldes historiques |
| `supabase/functions/check-alerts/index.ts` | Fix alertes expected_day côté push |

