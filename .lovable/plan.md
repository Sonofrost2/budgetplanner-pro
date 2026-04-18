
Refonte complète du module **Budgets** (forme + fond), alignée sur la charte premium glassmorphism + Coach Financier déjà appliquée à Notifications, Épargne et Transactions.

## A. Forme — design premium glassmorphism

1. **`BudgetsHeroHeader`** (nouveau)
   - Bandeau gradient (primary → accent), backdrop-blur, blobs décoratifs
   - KPIs animés : Budget total période, Consommé, Reste, % global
   - Ring circulaire "Santé budgétaire" (0-100) basé sur ratio respect des budgets
   - Mini sparkline 6 mois : taux de respect mensuel
   - Badge "X budgets en alerte" cliquable
   - CTA "Nouveau budget" + toggle vue (Cartes / Liste / Tableau)

2. **`BudgetCardPremium`** (nouveau, remplace l'affichage liste actuel)
   - Glass card avec ring circulaire SVG (réutilise `SavingsRingProgress` ou variant)
   - Severity tint : safe=secondary, warning=accent, exceeded=destructive, paused=muted
   - Affichage : icône catégorie, nom, période, ring %, montant consommé / limite
   - Hover reveal : actions rapides (Éditer, Pauser, Dupliquer, Supprimer)
   - Mini barre "jours restants dans la période" + projection fin de période
   - Badge "max/min/exact" selon `control_type`

3. **`BudgetGlobalStats` refonte** (déjà existe, à harmoniser)
   - Garder structure 4 cards mais moderniser : variations vs période précédente avec flèches ↑↓
   - Ajouter mini-trend par card

4. **Filtres refondus**
   - Pills uniformes glass : Tous / Dépenses / Revenus / En alerte / En pause / Archivés
   - Quick presets de période + recherche par nom

5. **Empty state Coach** : illustration + message ("Pas de budget ? Donnez un cadre à vos dépenses 🧭")

## B. Fond — Coach Financier

1. **`BudgetCoachInsights`** (nouveau, sous le hero)
   - 3 chips Coach dynamiques calculés client-side :
     - Budget le plus respecté ("🏆 Loyer : pile dans la cible")
     - Plus gros dépassement ("⚠️ Loisirs : +35% — pensez à ajuster")
     - Projection ("💡 À ce rythme, Alimentation dépassera de 12k FCFA")
   - Calcul depuis `budgets` + `spending` + jours écoulés vs total période
   - Dismissible, rotation max 3

2. **Toasts unifiés** : migrer tous les `toast.*` du module vers `coachToast`
   - Création/édition → `coachToast.saved`
   - Pause/reprise → `coachToast.remind`
   - Suppression → `coachToast.warn`
   - Échec → `coachToast.fail`

3. **Notifications palier** : déclencher `coachToast.warn` à 80% / `coachToast.fail` à 100% lors d'une mise à jour de transaction qui pousse un budget dans la zone critique (déjà géré côté `check-alerts`, on ajoute la version client immédiate)

4. **Micro-copy revue (FR/EN)**
   - "Budget" → "Cadre de dépense"
   - "Consommé" → "Déjà dépensé"
   - "Seuil" → "Alerte à"
   - Verbes positifs côté Coach

## C. Fichiers touchés

**Créer**
- `src/components/dashboard/budgets/BudgetsHeroHeader.tsx`
- `src/components/dashboard/budgets/BudgetCoachInsights.tsx`
- `src/components/dashboard/budgets/BudgetCardPremium.tsx`

**Refondre**
- `src/pages/dashboard/BudgetsPage.tsx` (intégration hero + insights + toggle vue + empty state Coach + migration toasts)
- `src/components/dashboard/budgets/BudgetGlobalStats.tsx` (variations vs période précédente)
- `src/components/dashboard/budgets/BudgetForm.tsx` (toasts → `coachToast`)

**i18n**
- `src/i18n/dashTranslations.ts` : clés `budgetsHero*`, `budgetsInsight*`, `budgetsCoach*`

## D. Hors-scope
- Aucune migration DB (toutes les données nécessaires existent déjà : `amount`, `period`, `control_type`, `alert_threshold`, `paused_at`, `carry_over`, etc.)
- Aucun changement RPC ni edge function
- L'onglet Évolution (`BudgetEvolutionTab`) garde sa logique actuelle, juste réharmonisé visuellement si besoin léger
- L'onglet Analyse (`BudgetAnalysisTab`) inchangé

## E. Mémoire
- Mettre à jour `mem://features/budgeting-logic/annualization-and-labels` avec section "Design refonte v2 : hero + ring + Coach insights + coachToast"
