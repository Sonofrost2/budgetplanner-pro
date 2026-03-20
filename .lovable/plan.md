

## Refonte complète du module Prévisions Financières

### Objectif
Transformer la page `/dashboard/forecasts` d'une page basique avec 3 onglets plats en un module premium riche, animé et visuellement impressionnant avec plus de données AI.

### 1. Enrichir le schéma AI (Edge Function)

**Fichier**: `supabase/functions/ai-forecast/index.ts`

Ajouter au tool schema :
- `health_score` (0-100) : score de santé financière global
- `health_label` : "Excellent" / "Bon" / "Fragile" / "Critique"
- `monthly_savings_potential` : montant d'économies potentielles identifiées
- `risk_alerts` : tableau d'alertes (texte + sévérité high/medium/low)
- `category_insights` : pour chaque catégorie dans detailed_forecasts, ajouter `trend` ("up"/"down"/"stable"), `advice` (conseil IA), `avg_last_3m`, `projected_next_month`
- `action_plan` : liste de 3-5 actions concrètes avec `title`, `impact_amount`, `difficulty` (easy/medium/hard), `description`

Enrichir le system prompt pour demander des conseils financiers actionnables et un score de santé.

### 2. Refonte complète de la page ForecastsPage

**Fichier**: `src/pages/dashboard/ForecastsPage.tsx` (réécriture)

**Structure en sections au lieu d'onglets** avec scroll vertical :

**a) Hero Section** — Score de santé financière
- Grand cercle animé (gauge circulaire) avec le score 0-100
- Label coloré (vert/jaune/orange/rouge) 
- 3 mini-cartes glassmorphism : revenu moyen, dépenses moyennes, taux d'épargne
- Bouton "Générer les prévisions IA" avec animation pulse quand pas encore généré

**b) Section Alertes & Risques**
- Cards avec icônes colorées selon la sévérité
- Animation d'entrée staggered (framer-motion)

**c) Section Projections Globales** (graphique principal)
- Area chart (au lieu de LineChart) avec gradient fill pour les 3 scénarios
- Toggle entre vue "Balance", "Revenus", "Dépenses"
- Tooltip custom glassmorphism

**d) Section Détail par Catégorie** 
- Cards pliables (Collapsible) avec icône catégorie, trend arrow, montant projeté
- Mini sparkline chart inline dans chaque card header
- Au clic : graphique détaillé + conseil IA personnalisé

**e) Section Plan d'Action**
- Cards avec badge difficulté, montant d'impact estimé
- Icônes visuelles par type d'action

**f) Section Tendances & Recommandations**
- Texte de tendances dans une card glassmorphism
- Liste de recommandations avec puces animées

### 3. Animations & UX

- `framer-motion` pour toutes les sections : fade-in + slide-up staggered
- `AnimatedNumber` pour les KPI
- Skeleton loaders pendant la génération AI
- Area charts avec gradients translucides
- Gauge circulaire animée (SVG avec motion)
- Loading state : animation de "cerveau qui réfléchit" avec texte progressif ("Analyse des revenus...", "Calcul des projections...", etc.)

### 4. Widget Dashboard (ForecastWidget)

**Fichier**: `src/components/dashboard/home/ForecastWidget.tsx`

Ajouter un mini indicateur de score de santé si un forecast a été généré (stocké en state/localStorage).

### 5. Traductions

**Fichier**: `src/i18n/dashTranslations.ts`

Ajouter les clés fr/en : `healthScore`, `healthExcellent/Good/Fragile/Critical`, `riskAlerts`, `actionPlan`, `impactAmount`, `difficulty`, `categoryInsight`, `projectedBalance`, `savingsPotential`, `loadingStep1/2/3/4`.

### Détails techniques

- Aucune modification de table DB requise
- La page reste gated par `canUseForecast` (Premium)
- Le forecast est stocké en state React (pas persisté en DB)
- Charts : recharts AreaChart avec `<defs>` pour les gradients SVG
- Gauge : SVG `<circle>` animé avec `motion` de framer-motion
- Loading steps : `useEffect` avec `setInterval` pour cycler les messages

