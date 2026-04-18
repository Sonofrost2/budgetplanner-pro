
# Plan — Refonte module Transactions (fond + forme)

## A. Forme — design premium glassmorphism Coach

1. **`TransactionsHeroHeader`** (nouveau)
   - Bandeau gradient (primary → secondary), backdrop-blur, blobs décoratifs
   - Total revenus / dépenses / solde net du mois en cours (AnimatedNumber)
   - Mini sparkline 30 jours (flux net journalier)
   - Compteur "X / limite mensuelle" pour plans gratuits avec ring
   - CTA "Nouvelle transaction" + "Transfert" dans le hero

2. **`TransactionInsightsBar`** (nouveau, sous le hero)
   - 3 chips Coach dynamiques :
     - Plus grosse dépense de la période ("Top dépense : Loyer 200k")
     - Catégorie la plus active ("Vous dépensez le + en Alimentation")
     - Anomalie détectée ("⚠️ +35% vs mois dernier en Loisirs")
   - Calculé client-side depuis transactions filtrées

3. **Filtres refondus**
   - Garder les pills, mais migration vers glass card uniforme
   - Quick presets : "Aujourd'hui", "7j", "30j", "Ce mois", "Mois dernier"
   - Bouton "Réinitialiser" plus visible

4. **`TransactionList` premium**
   - Ring de progression budgétaire mini sur chaque ligne quand catégorie a budget
   - Hover reveal : bouton dupliquer rapide
   - Empty state Coach (même style que Savings v2)

5. **Toasts unifiés via `coachToast`** (success/info/warn) — ton Coach
   - "Transaction enregistrée 💸 → solde mis à jour"
   - "5 transactions supprimées 🗑️"

## B. Fond — Coach Financier

1. **Détection d'anomalies client** (dans TransactionInsightsBar) : compare moyennes catégorie vs période courante
2. **Empty state motivant** : illustration + message Coach
3. **Micro-copy** revue : "Solde du mois", "Top dépense", "Anomalie"

## C. Fichiers
- **Créer** : `TransactionsHeroHeader.tsx`, `TransactionInsightsBar.tsx`
- **Refondre** : `TransactionsPage.tsx` (intégration), empty state dans `TransactionList.tsx`, migration toasts
- **i18n** : ajouter clés `txHero*`, `txInsight*`

## D. Hors-scope
- Pas de migration DB
- Pas de changement aux RPC ou edge functions
- Onglet Stats reste tel quel (déjà refondu récemment)
