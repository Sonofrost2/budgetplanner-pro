

Let me explore the current dashboard home structure first.
<lov-tool-use id="toolu_vrtx_01EviS8mhbVCfM61JGtxZQcq" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/dashboard/DashboardHome.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01AHjc2KhLyAzLMsLuqYca7w" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/dashboard/DashboardHome.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Anq7ERCHckPjXv3BMw9T7M" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/components/dashboard/home\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_018kdG3ZXKiLmFHD8q3vZPUD" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/dashboard/DashboardHome.tsx\", \"lines\": \"389-431\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01HyCf7uwrHABsiVLfcfJwsu" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/dashboard/home/StatsCards.tsx\", \"lines\": \"1-40\"}">
</lov-tool-use>
I have enough context now to plan the dashboard refonte aligned with the Coach Financier system already applied to other modules.

<lov-plan>

## Refonte complète du module Tableau de bord

### Vision
Aligner `DashboardHome` sur le design system **Coach Financier glassmorphism** déjà appliqué aux modules Transactions, Budgets, Savings, Wealth — avec un **HeroHeader premium**, des **KPI cards animés**, des **Coach insights contextuels**, et une **expérience ERP** cohérente.

---

### A. Forme — refonte visuelle

**1. Nouveau `DashboardHeroHeader.tsx`** (créé)
- Surface gradient `var(--gradient-primary)` avec blob décoratif + grain subtil
- Avatar utilisateur en ring gradient + greeting dynamique (`Bonjour/Bon après-midi/Bonsoir`) + nom
- Sous-titre "ERP Financier — Vue d'ensemble" avec date du jour
- 3 KPI inline animés (AnimatedNumber) : **Solde net**, **Cash flow période**, **Taux d'épargne** avec mini sparkline
- Selecteur période (chips horizontales : Aujourd'hui / Semaine / Mois / Trim. / Année / Custom) — pill rounded-xl actif avec gradient
- Boutons CTA : **Saisie rapide ⚡** (ouvre quick-add via callback) + **Mode édition** (toggle layout)

**2. Refonte `StatsCards.tsx`**
- Cards rounded-2xl glass `bg-card/50 backdrop-blur-xl` avec border `border-border/50`
- Hover : `translate-y-[-2px]` + shadow primary glow
- Icône dans conteneur gradient mini (`bg-primary/15 rounded-xl`)
- Sparkline plus épaisse + gradient fill subtil
- Trend pills harmonisés (vert/rouge avec glow)
- Layout : 4 colonnes desktop (Solde, Revenus, Dépenses, Épargne) + 2e ligne 3 cards (Net, Daily avg, Top dépense)

**3. Coach insights bar (nouveau `DashboardCoachInsights.tsx`)**
- Bandeau scrollable horizontal de 3-5 chips contextuels :
  - 🔥 Streak transactions (réutilise logique TransactionInsightsBar)
  - ⚠️ Budgets dépassés (count)
  - 🎯 Progression objectifs épargne
  - 📈 Évolution vs période précédente
  - 💡 Suggestion IA du jour (récupère 1 message de `ai_messages` ou suggestion statique)
- Style chips identique à `TransactionInsightsBar` (gradient pills glass)

**4. Widgets — harmonisation**
- Tous les widgets (`AccountsSummaryWidget`, `BudgetsWidget`, etc.) reçoivent un wrapper `card-glass` cohérent avec rounded-2xl, header avec icône gradient, hover lift
- Pas de refonte fond des widgets eux-mêmes (déjà OK), juste consistance shell visuelle via `SortableWidget`

**5. Mode édition amélioré**
- Banner d'édition redesigné en glass premium avec icône animée
- Drag handle visible au hover sur chaque widget (icône GripVertical en top-right)
- Toggle visibility par widget via menu dropdown (icône Eye/EyeOff)

---

### B. Fond — intelligence ajoutée

**1. Hook `useDashboardInsights.tsx` (créé)**
- Calcule en useMemo : streak transactions, budgets dépassés, progression épargne %, evolution cash flow %
- Retourne array d'insights typés pour la coach bar

**2. Quick-add intégré**
- Bouton ⚡ dans le hero ouvre la même UI que `TransactionsHeroHeader` (panel inline avec input langage naturel)
- Réutilise edge function `ai-quick-parse` existante
- Sur succès : insère directement la transaction + coachToast

**3. Période persistée**
- localStorage `bp_dashboard_period` mémorise la dernière période choisie
- Custom range mémorisé séparément

---

### C. Fichiers

**Créés :**
- `src/components/dashboard/home/DashboardHeroHeader.tsx`
- `src/components/dashboard/home/DashboardCoachInsights.tsx`
- `src/hooks/useDashboardInsights.tsx`

**Modifiés :**
- `src/pages/dashboard/DashboardHome.tsx` — intégrer hero + coach bar, retirer ancien header inline
- `src/components/dashboard/home/StatsCards.tsx` — refonte glass + sparkline gradient
- `src/components/dashboard/home/SortableWidget.tsx` — drag handle + visibility menu
- `src/i18n/dashTranslations.ts` — clés `dashboardOverview`, `quickAddCta`, `customizeLayout`, `streakDays`, `aiTipOfDay`

**Mémoire :**
- Créer `mem://features/dashboard-home-v2.md` documentant la refonte (hero + coach bar + quick-add + persistance période)

---

### D. Hors-scope
- Pas de modification des widgets internes (logique métier intacte)
- Pas de nouveaux widgets (juste shell harmonisé)
- Pas de drag-and-drop multi-colonnes (garde grille 5-cols actuelle)
- Pas de tableau de bord par profil (admin/famille)

