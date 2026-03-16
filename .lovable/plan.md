

## Plan : Simulation double scenario + date anniversaire + filtre charges recurrentes

### 1. Migration base de donnees

Ajouter la colonne `contribution_day` (integer 1-31, nullable) a `savings_goals`.

```sql
ALTER TABLE public.savings_goals ADD COLUMN contribution_day integer DEFAULT NULL;
```

### 2. Edge Function `ai-savings-simulate` — Refonte complete

**A. Accepter `contribution_day` dans le body**

**B. Calcul sur dates reelles avec `contribution_day`**
- Placer chaque cotisation au jour exact (`contribution_day`) de chaque mois au lieu de "debut de mois"
- Calculer les interets par intervalle reel entre chaque date de depot
- Utiliser `Date` reelles (pas approximation 30 jours)

**C. Double scenario**
- **Scenario 1 "Continue"** : appeler `computeProrataProjections` avec `monthlyContribution` normal
- **Scenario 2 "Arret aujourd'hui"** : appeler avec `monthlyContribution = 0` (seuls les interets sur le capital actuel courent)
- Retourner les deux jeux : `projections_continue` et `projections_stop_now`

**D. Enrichir le prompt IA** pour comparer les deux scenarios dans les recommandations

Structure de reponse :
```json
{
  "continue": { "monthly_projections", "interest_income_1y/3y/5y", "estimated_goal_date" },
  "stop_now": { "monthly_projections", "interest_income_1y/3y/5y" },
  "interest_lost": 12345,
  "summary", "recommendations"
}
```

### 3. Frontend `SavingsPage.tsx`

**A. Formulaire — Champ `contribution_day`**
- Ajouter `contribution_day: ''` au state `form`
- Ajouter un Select (1-31) entre "Cotisation mensuelle" et "Date debut / Date fin"
- Label : "Jour de cotisation" / "Contribution day"
- Passer la valeur dans `handleCreateOrEdit` et `handleSimulate`
- Charger la valeur existante lors de l'edition

**B. Dialog de simulation — Double scenario avec Tabs**
- Mettre a jour `SimulationResult` pour inclure `continue` et `stop_now`
- Ajouter des Tabs dans le dialog : "Cotisations continues" / "Arret aujourd'hui"
- Chaque onglet affiche ses propres interets 1/3/5 ans, projections mensuelles, date estimee
- Afficher un bandeau comparatif : "Manque a gagner si arret : X CFA"

### 4. Charges recurrentes `RecurringPage.tsx`

Le filtre par frequence existe deja (lignes 264-283) avec des chips. Il fonctionne via `filterFreq` state. Aucune modification necessaire sur ce point — le filtre est deja en place.

**Verification** : le filtre `filterFreq` filtre bien `items` dans `filteredItems` (ligne 70). Confirme.

### 5. Traductions `dashTranslations.ts`

Ajouter cles : `contributionDay`, `contributionDayDesc`, `scenarioContinue`, `scenarioStopNow`, `interestLost`, `ifYouStopToday`, `interestGainedWithoutContrib`

### Fichiers impactes

| # | Fichier | Action |
|---|---------|--------|
| 1 | `savings_goals` (migration) | Ajouter `contribution_day` |
| 2 | `supabase/functions/ai-savings-simulate/index.ts` | Double scenario + calcul dates reelles + contribution_day |
| 3 | `src/pages/dashboard/SavingsPage.tsx` | Champ contribution_day + UI double scenario |
| 4 | `src/i18n/dashTranslations.ts` | Nouvelles cles |

