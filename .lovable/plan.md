
The user wants a complete overhaul (content + form) of the Savings module, similar to what we did for Notifications. Let me explore current state.

Current files (from context):
- `src/pages/dashboard/SavingsPage.tsx` (main page)
- `src/components/dashboard/savings/SavingsControlTable.tsx`
- `src/components/dashboard/savings/SavingsDialogs.tsx`
- `src/components/dashboard/savings/SavingsGlobalStats.tsx`
- `src/components/dashboard/savings/SavingsGoalCard.tsx`
- `src/components/dashboard/savings/SavingsSummaryTable.tsx`
- `src/components/dashboard/savings/PartialWithdrawDialog.tsx`
- `src/components/dashboard/home/SavingsWidget.tsx`
- `src/components/dashboard/tabs/SavingsEvolutionTab.tsx`
- `src/components/dashboard/tabs/SavingsProjectionsTab.tsx`

Memory `mem://features/savings-management`: transactions = source of truth, useSavingsPageData, dynamic recalc.

Goal: align Savings with the premium glassmorphism + Coach Financier voice (notifications design system) and add depth (hero, narrative insights, smarter empty states, motivation).

## Plan — Refonte Module Épargne

### A. Form (visuelle) — design glassmorphism premium

1. **`SavingsHeroHeader`** (nouveau) — calque sur `WealthHeroHeader`
   - Gradient soft (secondary → primary), backdrop-blur
   - Total épargné, total objectif, % global animé (ring + AnimatedNumber)
   - Mini sparkline 6 mois (apports nets)
   - Badge "Streak" : nb mois consécutifs avec apport
   - CTA "Nouvel objectif" + toggle vue (Cartes / Tableau)

2. **`SavingsGoalCard` premium**
   - Glass card avec ring de progression circulaire (SVG) au lieu de simple Progress bar
   - Severity tint : completed=secondary, late=destructive, on-track=primary, ahead=emerald
   - Hover : reveal actions rapides (Apport, Retrait, Détails)
   - Mini timeline des 3 derniers apports en bas
   - Echéance avec compte-à-rebours humanisé ("dans 4 mois")

3. **`SavingsGlobalStats` refonte**
   - 4 stat cards glass : Total épargné, Reste à atteindre, Apport mensuel moyen, Projection 12M
   - Variations vs mois dernier (↑↓ %) avec couleur sémantique

4. **`SavingsSummaryTable`** : header sticky, lignes hover glass, badges sévérité harmonisés

5. **Empty state Coach** : illustration + message Coach ("Pas encore d'objectif ? Commençons par un petit défi 💡")

6. **`SavingsWidget` (home)** : aligner avec ring circulaire mini + streak

### B. Fond (contenu / Coach Financier)

1. **`SavingsCoachInsights`** (nouveau composant)
   - Bandeau insights dynamiques générés côté client :
     - "🎯 Vacances : à ce rythme, vous l'atteignez 2 mois en avance"
     - "⚠️ Voiture : retard de 15% — augmentez de 12 000 XOF/mois pour rattraper"
     - "🎉 Fonds d'urgence atteint ! Réinvestir / Garder / Archiver ?"
     - "💡 Vous épargnez 18% de vos revenus — au-dessus de la moyenne (15%)"
   - Calcul : compare current vs (target × elapsed / total duration)
   - Max 3 insights affichés, rotation, dismissible

2. **Toasts unifiés** : remplacer `toast.*` dans Savings par `coachToast` (success/info/warn) avec ton Coach

3. **Labels & micro-copy** revus (FR/EN) : verbes d'action positifs, pas de jargon
   - "Apport" → "Alimenter mon objectif"
   - "Retrait partiel" → "Puiser dans mon épargne"
   - "Solde" → "Déjà épargné"

4. **Notifications liées** : déclencher coach toast à 25/50/75/100% (palier atteint)

### C. Fichiers touchés
- **Créer** : `SavingsHeroHeader.tsx`, `SavingsCoachInsights.tsx`, `SavingsRingProgress.tsx` (SVG ring réutilisable)
- **Refondre** : `SavingsGoalCard.tsx`, `SavingsGlobalStats.tsx`, `SavingsSummaryTable.tsx`, `SavingsPage.tsx` (intégration), `home/SavingsWidget.tsx`
- **Migrer toasts** : `SavingsDialogs.tsx`, `PartialWithdrawDialog.tsx`, `SavingsControlTable.tsx` → `coachToast`
- **i18n** : ajouter clés `savingsHero*`, `savingsInsight*`, `savingsCoach*` dans `dashTranslations.ts`

### D. Hors-scope (à confirmer si nécessaire)
- Pas de migration DB (toutes les data nécessaires existent déjà : `current_amount`, `target_amount`, `monthly_contribution`, `start_date`, `deadline`, `interest_rate`)
- Pas de changement RPC
- L'onglet Projections (`SavingsProjectionsTab`) garde sa logique, juste réharmonisé visuellement

### E. Mémoire
- Mettre à jour `mem://features/savings-management` avec section "Design refonte v2 : hero + ring + Coach insights"
