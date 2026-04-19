

# Refonte complète du module Prévisions

## Vision
Faire du module **Prévisions** un véritable **cockpit de planification financière prédictive**, dans la lignée Coach Financier. Aujourd'hui c'est une page IA monolithique (1 bouton → 1 résultat figé). On la transforme en **expérience interactive, mesurable et actionnable**.

---

## A. FOND (logique métier)

### A1. Auto-régénération + cache intelligent
- Hash SHA des transactions (count + somme + dernière date) → si change ≥ 5% OU > 7 jours → bouton "Actualiser" pulse en rouge
- Cache localStorage par hash : `forecast_cache_{hash}` (évite régénération inutile au reload)
- Indicateur "Dernière analyse : il y a X jours" avec couleur santé

### A2. Comparaison vs réel (back-test)
- Nouvel onglet **"Fiabilité"** : pour chaque mois passé déjà projeté, compare projection IA vs cash-flow réel
- Score de fiabilité global (% MAPE inversé) affiché en badge dans le hero
- Graph dual : ligne projection (pointillé) + ligne réel (plein) sur N derniers mois

### A3. Scénarios what-if interactifs
- Nouvel onglet **"Simulateur"** avec 4 sliders :
  - Variation revenus (-30% à +50%)
  - Variation dépenses (-30% à +50%)  
  - Nouveau budget mensuel (0 à 500k)
  - Versement épargne mensuel (0 à 200k)
- Recalcul **client-side instantané** sur la base de la projection IA (pas de re-call edge)
- Comparaison côte à côte : "Sans changement" vs "Avec scénario"
- Bouton "Sauver ce scénario" → localStorage (3 scénarios max)

### A4. Recommandations actionnables
- Chaque tip IA devient un bouton CTA contextuel :
  - "Crée un budget Restaurant à 50k" → ouvre `BudgetForm` pré-rempli
  - "Fixe un objectif épargne 100k/mois" → ouvre `SavingsForm` pré-rempli
  - "Active une alerte solde bas" → toggle `notification_preferences.low_balance`
- Marquage "✓ Appliqué" persistant en localStorage par tip-id

### A5. **Bonus activables** (la 5e direction "plus d'options")
- **Détection saisonnalité** : repère les pics récurrents (ex. salaire le 28, loyer le 1er) et les colore sur la projection
- **Alerte solde négatif prévisionnel** : push notification si projection 30 j passe sous seuil
- **Export PDF du plan** : "Mon plan financier 12 mois" prêt à imprimer

---

## B. FORME (visuel)

### B1. HeroHeaderShell glass
Remplace le `<h2>` brut par un vrai `WealthHeroHeader`-like :
- Icône Brain dans gradient + titre + sous-titre Coach (ex. "🎯 Score 78/100 · belle santé !")
- 3 KPI animés inline : Revenus moy / Dépenses moy / Épargne potentielle
- Badge Fiabilité (back-test MAPE)
- CTA "Actualiser" + dernière analyse
- Sparkline 6 mois passés en bas

### B2. Onglets glass Coach (déjà appliqués ailleurs)
4 onglets :
1. **🔮 Projection** — graphique principal + sélecteur horizon 3/6/12/24m + chips mode (Solde / Revenus / Dépenses)
2. **⚠️ Risques & Recos** — alertes + tips actionnables
3. **🎚️ Simulateur** — sliders what-if + diff visuel
4. **📊 Fiabilité** — back-test mois par mois

### B3. Polish
- Loading state : sparkles animés sur la zone graphique au lieu de la carte centrale
- Empty state : illustration + onboarding 3 étapes ("Ajoute 30j de transactions → Génère → Découvre ton futur")
- Mode édition compact pour mobile (< 640px) : stack vertical sliders

---

## C. Edge function `ai-forecast` — extension

Ajout au prompt système :
- Demander à l'IA de retourner aussi `historical_predictions[]` (ce qu'elle aurait prédit pour les 6 mois passés sur la base des données antérieures) → permet le back-test côté client
- Retourner `seasonality_pattern[]` (jours du mois récurrents)
- Garder rétro-compatible : tous nouveaux champs optionnels

---

## D. Fichiers

**Créés :**
- `src/components/dashboard/forecasts/ForecastsHeroHeader.tsx`
- `src/components/dashboard/forecasts/ForecastProjectionTab.tsx`
- `src/components/dashboard/forecasts/ForecastRisksTab.tsx`
- `src/components/dashboard/forecasts/ForecastSimulatorTab.tsx`
- `src/components/dashboard/forecasts/ForecastReliabilityTab.tsx`
- `src/components/dashboard/forecasts/ActionableRecommendation.tsx`
- `src/lib/forecastBacktest.ts` (calcul MAPE + alignement projection/réel)
- `src/lib/forecastSimulator.ts` (recalcul scénario what-if pur fonction)
- `src/lib/forecastCache.ts` (hash + localStorage)

**Modifiés :**
- `src/pages/dashboard/ForecastsPage.tsx` (orchestration légère, ~150 lignes au lieu de 545)
- `supabase/functions/ai-forecast/index.ts` (prompt + back-test + saisonnalité)
- `src/i18n/dashTranslations.ts` (nouvelles clés)

**Mémoire :**
- `mem://features/forecasts-v2.md` documentant la refonte

---

## E. Hors-scope (volontairement)
- Pas de modification des autres modules (Budgets/Savings/Notifs touchés uniquement via CTA)
- Pas de nouvelle table SQL — tout passe par l'edge function existante + localStorage
- Pas de comparaison familiale ou multi-utilisateur
- Pas d'export Excel (PDF seul si A5 retenu)

---

## F. Estimation
~9-10 nouveaux fichiers, ~1500 lignes total, 1 edge function étendue. Pas de migration DB.

