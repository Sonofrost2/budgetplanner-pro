## Contexte (constats factuels dans le code actuel)

J'ai relu `src/components/dashboard/NotificationBell.tsx`, `supabase/functions/check-alerts/index.ts`, `src/lib/budgetProjection.ts`, `src/components/dashboard/savings/SavingsGoalCard.tsx` et `src/pages/dashboard/SavingsPage.tsx`. Voici ce qui ne va pas, point par point :

1. **"Budget à 100%"** : le titre affiche `Math.round(pct)` mais le corps dit toujours `seuil atteint (80%)` — d'où la confusion. La notif est ré-émise tant que `pct >= threshold`, sans signature d'activité côté cloche (la dedup `activitySig` n'existe que dans l'edge function, pas dans le hook `useBudgetNotifications`).
2. **"Objectif non atteint"** : aujourd'hui le calcul ne croise jamais budget ↔ objectif d'épargne. Aucune colonne `linked_savings_goal_id` sur `budgets` ni `linked_budget_id` sur `savings_goals`.
3. **"Rappel épargne"** : `monthly_contribution` est lu depuis `savings_goals` mais aucune harmonisation avec un éventuel budget lié, ni prise en compte de `start_date` futur (cf. point 9).
4. **"Écarts de solde"** : le calcul théorique fait `opening_balance + Σ(income - expense)` en excluant `linked_transfer_id`, mais il **inclut les `cash_counts**` (qui modifient `real_balance` directement) → écart artificiel. De plus le seuil `Math.min(500, |real|*0.01 || 500)` aboutit toujours à 500 (XOF), ce qui multiplie les faux positifs sur des comptes à gros solde.
5. **"Budgets maîtrisés"** : `shouldFireBilan` ne déclenche que le dernier jour de période, mais pour les budgets `min` (revenus) atteints, la notif "objectif atteint" se renvoie chaque rafraîchissement tant qu'aucune trace d'envoi n'est mémorisée localement.
6. **"Budget dépassé"** : même problème de répétition que #1 (pas de signature d'activité côté cloche).
7. **"Échéance prévue"** : `computeDaysRemaining` retourne bien `daysLeft = 5`, mais `shouldFireUpcoming` ne fire qu'aux paliers **0, 2, 5**. Si l'utilisateur ouvre le 28 du mois pour une échéance le 2 (4 jours), aucun palier n'est atteint → silence. C'est exactement le bug "internet le 2".
8. **Préremplissage** : le dialogue "ajouter versement" depuis l'épargne (`addAmountDialog`) ne remplit ni le montant (`monthly_contribution`), ni le compte source par défaut.
9. **Épargne "en retard"** : `SavingsGoalCard` calcule `status='behind'` dès que `monthlyAvg < monthlyNeeded * 0.9`, **sans regarder `start_date**` ni `contribution_day` — donc un objectif qui démarre fin mai 2026 est marqué en retard aujourd'hui.
10. **Perfs** : la cloche tire 8 requêtes en série au montage + intervalle 5 min + realtime 3 tables ; sur mobile elle bloque le first paint.

---

## Plan d'action

### A. Schéma — lier Budget ↔ Épargne (1 migration)

```sql
ALTER TABLE public.budgets        ADD COLUMN linked_savings_goal_id uuid REFERENCES public.savings_goals(id) ON DELETE SET NULL;
ALTER TABLE public.savings_goals  ADD COLUMN linked_budget_id       uuid REFERENCES public.budgets(id)       ON DELETE SET NULL;
CREATE INDEX idx_budgets_linked_savings        ON public.budgets(linked_savings_goal_id) WHERE linked_savings_goal_id IS NOT NULL;
CREATE INDEX idx_savings_goals_linked_budget   ON public.savings_goals(linked_budget_id)  WHERE linked_budget_id  IS NOT NULL;
```

Trigger d'harmonisation : à chaque `INSERT/UPDATE` sur l'un, recopier `monthly_contribution`/`amount`, `contribution_day`/`expected_day`, `start_date`/`reference_date` vers l'autre s'ils sont vides ou si l'utilisateur a coché "synchroniser".

### B. UI — création croisée (BudgetForm + Savings goal form)

Dans `BudgetForm.tsx` :

- Champ "Lier à un objectif d'épargne" (Combobox des `savings_goals` actifs) + bouton **"Créer un objectif depuis ce budget"** → ouvre le dialogue épargne pré-rempli (nom, montant mensuel, contribution_day = expected_day).

Dans `SavingsPage.tsx` (formulaire goal) :

- Champ "Lier à un budget" + bouton **"Créer un budget depuis cet objectif"** → demande confirmation puis insère un budget `expense` (catégorie "Épargne") avec `amount = monthly_contribution`, `expected_day = contribution_day`, `period = 'monthly'`, `linked_savings_goal_id`.

À chaque action, dialogue de confirmation natif (ResponsiveFormDialog) résumant ce qui sera créé.

### C. Cloche — refonte des règles (`NotificationBell.tsx`)

Pour CHAQUE notif de statut (budget_warning, budget_exceeded, savings_behind, savings_no_contrib), introduire une **signature d'activité** persistée en `localStorage` :

```ts
// Clé: `${type}-${entityId}-${periodTag}`
// Valeur: { sig: `tx${count}_amt${round(spent)}_pct${bucket10}`, ts }
```

Règle : on n'émet la notif que si `sig` a changé depuis la dernière émission OU si on a franchi un nouveau bucket de 10 pts. Sinon → silence total (même si la cadence "weekly" est passée).

Corriger les libellés :

- "Budget à 75%" → message : `${name} : 12 500 / 16 000 dépensés ce mois (seuil ${threshold}%)` — plus jamais le doublon "100% / seuil 80%".
- "Budget dépassé" → `${name} : +3 200 au-dessus de 16 000 (depuis le 12)` avec date de la tx qui a fait basculer.

**Échéance prévue (point 7)** : remplacer `shouldFireUpcoming([0,2,5])` par une fenêtre **continue J-7 → J-0** avec déclenchement journalier MAIS dedup par `(budget_id, periodStart, daysLeft)` côté `localStorage` → on voit le J-4, J-3, J-2, J-1, J-0 sans spam (un seul affichage par valeur de daysLeft). Idem côté edge : étendre la liste `[7,5,3,2,1,0]`.

Tri : critique > échéances passées > J-0 > J-1..J-7 > seuils > bilans.

Tu peux inclure ceux qui seront payés dans 1 mois ou 2 mois (si tu veux rester en jours, tu convertis), **uniquement pour les budgets plurimensuels (trimestriels ou semestriels)**

### D. Cloche — écarts de solde (point 4)

Réécrire le calcul théorique :

```
theoretical = opening_balance
            + Σ(income où linked_transfer_id IS NULL)
            - Σ(expense où linked_transfer_id IS NULL)
            + Σ(transfers ENTRANTS sur ce compte)
            - Σ(transfers SORTANTS sur ce compte)
```

puis comparer à `real_balance`. Aujourd'hui les transferts sont totalement exclus → faux écart de la valeur exacte du transfert. Seuil : `max(1000, |real|*0.005)` au lieu de `min(500, ...)` (1000 XOF mini, 0.5% pour les gros comptes). Exclure les comptes archivés (déjà fait) **et les comptes type `cash**` dont l'écart est attendu (régulé par `cash_counts`). Une seule notif agrégée si plusieurs comptes : "Écart sur 11 comptes (total : X)" avec bouton "Lancer un comptage".

### E. Bilan budget maîtrisé (point 5)

- N'émettre `budget_savings` (income atteint) qu'**une seule fois** par période : clé localStorage `budget-target-reached-${budget.id}-${periodEndStr}`.
- Si une nouvelle transaction income arrive dans la même période APRÈS l'atteinte → nouvelle notif "🎉 +X au-dessus de votre objectif initial" (delta vs montant du budget).

### F. Épargne "en retard" (point 9)

Dans `SavingsGoalCard.tsx` (calcul `scheduleInfo`) ET dans la cloche :

```ts
const startDate = goal.start_date ? parseLocalDate(goal.start_date) : null;
if (startDate && startDate > now) {
  status = 'pending'; // → libellé "Démarre le 31 mai 2026"
} else if (goal.contribution_day && now.getDate() < goal.contribution_day) {
  status = 'on_track'; // pas encore arrivé ce mois
} else {
  // logique behind/ahead actuelle
}
```

Ajouter `status='pending'` partout (badge bleu "À venir").

### G. Préremplissage versement épargne (point 8)

Dans `SavingsPage.tsx` ligne 1044, remplacer :

```ts
onAddSaving={() => { setAddAmountDialog(g.id); setAddAmount(''); setSourceAccountId(''); }}
```

par :

```ts
onAddSaving={() => {
  setAddAmountDialog(g.id);
  setAddAmount(String(g.monthly_contribution || ''));
  setSourceAccountId(/* compte courant principal s'il existe, sinon '' */);
}}
```

Ajouter dans le hook un sélecteur du compte non-épargne le plus récemment utilisé.

### H. Edge function `check-alerts` — alignements

- Adopter la même "signature d'activité" que la cloche (déjà en partie fait, à étendre à `budget_threshold`, `budget_target_behind`, `savings_no_contribution`).
- Étendre les paliers échéance à `[7,5,3,2,1,0]` et augmenter les paliers pour inclure les budgets plurimensuels
- Recalcul écart de solde idem section D.
- Respecter `start_date` futur des objectifs (skip total).

### I. Performances (point 10)

- **Cloche** : passer de 8 requêtes parallèles à un **RPC unique** `get_notification_context(uid)` retournant un JSON agrégé → 1 round-trip au lieu de 8. Repli sur les requêtes individuelles si le RPC échoue.
- Lazy-load du popover : ne charger les données que si l'utilisateur ouvre la cloche, sauf badge count (RPC léger `get_notification_count`).
- `BudgetCoachInsights` : envelopper `motion.div` dans `forwardRef` pour supprimer le warning React (capture console).
- `useRealtimeSync` : ajouter un `throttle` 2 s sur `invalidate` pour éviter les rafraîchissements en cascade lors d'imports.
- Vite : confirmer `manualChunks` pour `framer-motion` + `recharts` (déjà en mémoire).
- Mobile : `IntersectionObserver` pour différer le montage de `BudgetCoachInsights`, `SavingsCoachInsights`, `WealthAnalysisTab` lorsqu'ils sont hors viewport.

---

## Détails techniques (résumé)


| #   | Fichier                                                      | Type                               |
| --- | ------------------------------------------------------------ | ---------------------------------- |
| A   | `supabase/migrations/<ts>_link_budget_savings.sql`           | nouveau                            |
| B   | `src/components/dashboard/budgets/BudgetForm.tsx`            | edit                               |
| B   | `src/pages/dashboard/SavingsPage.tsx` (form goal)            | edit                               |
| C   | `src/components/dashboard/NotificationBell.tsx`              | refactor                           |
| C   | `src/lib/notificationCadence.ts`                             | edit (signature, fenêtre J-7..J-0) |
| D   | `src/components/dashboard/NotificationBell.tsx` (calc solde) | edit                               |
| D   | `supabase/functions/check-alerts/index.ts`                   | edit                               |
| E   | `src/components/dashboard/NotificationBell.tsx`              | edit                               |
| F   | `src/components/dashboard/savings/SavingsGoalCard.tsx`       | edit                               |
| F   | `src/components/dashboard/NotificationBell.tsx`              | edit                               |
| G   | `src/pages/dashboard/SavingsPage.tsx`                        | edit                               |
| H   | `supabase/functions/check-alerts/index.ts`                   | edit                               |
| I   | `supabase/migrations/<ts>_notification_rpc.sql`              | nouveau (RPC)                      |
| I   | `src/components/dashboard/NotificationBell.tsx`              | edit (RPC + lazy)                  |
| I   | `src/components/dashboard/budgets/BudgetCoachInsights.tsx`   | fix forwardRef                     |
| I   | `src/hooks/useRealtimeSync.tsx`                              | edit (throttle)                    |


Aucun changement d'auth ni de RLS. Aucune dépendance npm ajoutée.

## Résultat attendu

- Notifs Budget : titre et corps **cohérents** (`75% — 12k/16k dépensés`), **plus de spam** tant que rien ne bouge, échéance visible dès J-7.
- Lien Budget ↔ Épargne fonctionnel dans les deux sens, avec assistant de création croisée.
- "Rappel épargne" qui respecte `start_date`, `contribution_day` et le budget lié.
- "Écart de solde" recalculé correctement (transferts comptés, seuil adapté), agrégé en 1 notif.
- "Budget maîtrisé" / "Objectif atteint" : une seule fois par période, ré-émis seulement en cas d'amélioration.
- Épargne future ne s'affiche plus comme "en retard" : badge "Démarre le …".
- Versement préfilé avec montant + compte source intelligent.
- Cloche : 1 requête au lieu de 8 + lazy → first paint mobile sensiblement plus rapide.