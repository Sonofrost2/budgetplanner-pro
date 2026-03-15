

## Plan complet : Refonte du module Budget

### Améliorations proposées

**A. Bandeau de statistiques globales** — Nouveau composant `BudgetGlobalStats.tsx` affiché en haut de la page avec 4 KPI :
- Budget total annualisé (hebdo × 52, mensuel × 12, trimestriel × 4, etc.)
- Consommé total de la période courante (somme des spending)
- Taux de consommation global (%)
- Nombre de budgets en alerte (dépassés ou sous-objectif)

**B. Indicateurs enrichis sur chaque carte budget** :
- Budget annualisé en petit sous le montant principal
- Jours restants dans la période courante
- Rythme de consommation journalier moyen vs rythme attendu (indicateur tempo)
- Projection fin de période : `(consommé / jours écoulés) × jours totaux`

**C. Correction du rapport Budget vs Réel** (`BudgetVsActualReport.tsx`) :
- Utiliser la période réelle de chaque budget (comme `BudgetsPage` le fait déjà) au lieu de toujours forcer le mois courant
- Ajouter une colonne "Projection" et "Annualisé"

**D. Suggestions IA pour création de budgets** :
- Nouvelle Edge Function `ai-budget-suggest` qui analyse les 3 derniers mois de transactions par catégorie
- Identifie les catégories sans budget existant ayant des dépenses/revenus récurrents
- Retourne des suggestions avec montant, période et justification
- Bouton "✨ Suggestions IA" dans l'en-tête de la page, ouvre un dialog avec les propositions
- Chaque suggestion peut être acceptée (pré-remplit le formulaire de création)

**E. Historique de consommation par budget** :
- Mini-sparkline sur chaque carte montrant l'évolution de la consommation sur les 6 dernières périodes
- Requête RPC existante `get_budget_spending` appelée pour chaque période passée

**F. Alertes budget améliorées dans `NotificationBell`** :
- Inclure le rythme de consommation : alerte si le rythme projette un dépassement avant fin de période (pas seulement quand le seuil est atteint)

### Détails techniques

#### Multiplicateurs de période
```text
daily: 365, weekly: 52, monthly: 12, quarterly: 4, semi_annual: 2, yearly: 1
```

#### Calcul des jours restants et projection
```text
periodStart / periodEnd → déjà calculé dans budgetPeriodRanges
joursÉcoulés = today - periodStart + 1
joursTotaux = periodEnd - periodStart + 1
projection = (consommé / joursÉcoulés) × joursTotaux
```

#### Edge Function `ai-budget-suggest`
- Reçoit : `{ categories, existingBudgets, transactionSummary }` (somme par catégorie sur 3 mois)
- Utilise Gemini Flash via Lovable AI gateway (LOVABLE_API_KEY déjà configuré)
- Retourne : `[{ name, category_id, amount, period, type, reason }]`

### Fichiers impactés

| Fichier | Action |
|---------|--------|
| `src/components/dashboard/budgets/BudgetGlobalStats.tsx` | Créer — bandeau 4 KPI |
| `src/pages/dashboard/BudgetsPage.tsx` | Modifier — intégrer stats, projection, jours restants, sparkline, bouton IA |
| `src/components/dashboard/reports/BudgetVsActualReport.tsx` | Modifier — période réelle + colonnes projection/annualisé |
| `supabase/functions/ai-budget-suggest/index.ts` | Créer — suggestions IA |
| `supabase/config.toml` | Ajouter `ai-budget-suggest` |
| `src/i18n/dashTranslations.ts` | Ajouter ~25 clés fr/en |
| `src/components/dashboard/NotificationBell.tsx` | Modifier — alerte prédictive par rythme |

