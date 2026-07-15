# Refonte v2 — Module Transactions

Objectif : rendre le module lisible, rapide et cohérent (calculs justes hors transferts), avec un formulaire fluide et des sous-pages harmonisées.

## 1. Calculs sains (fondation)

Créer un helper unique `src/lib/transactionMath.ts` :
- `isTransfer(tx)` — déjà présent côté liste, on le centralise.
- `sumIncome / sumExpense / netFlow` — excluent systématiquement les transferts.
- `groupByPeriod(txs, granularity)` — jour / semaine / mois, avec bornes ISO.
- `comparePeriods(current, previous)` — renvoie delta absolu + % + tendance.

Impact : `TransactionsHeroHeader`, `TransactionInsightsBar`, cartes KPI Stats, graphes, exports. Fin des doublons de logique.

## 2. Onglet Gestion — liste + filtres + recherche

**Barre de recherche avancée** (nouveau composant `SmartSearchInput`)
- Opérateurs : `>1000`, `<500`, `=250`, `montant:1000..5000`, `compte:wave`, `cat:transport`, `tag:vacances`, `type:expense`.
- Chips visibles quand un opérateur est parsé, suppression au clic.
- Suggestions instantanées (comptes, catégories, tags récents).
- Raccourci `/` pour focus, `Esc` pour vider.

**Filtres persistés + Vues sauvegardées**
- Réutilise la table existante `saved_filters`.
- Sheet "Filtres avancés" gagne une section "Mes vues" avec CRUD (nom, icône, couleur).
- Le dernier filtre actif est mémorisé en `localStorage` par utilisateur.

**Liste**
- Densité configurable (Confort / Compact / Ultra-compact) mémorisée.
- Tri multi-colonnes (Date + Montant) avec badges d'ordre.
- Actions bulk existantes conservées ; ajout de "Assigner tag" et "Convertir en récurrent".
- Header sticky reste, on retire la double barre de compte total (déjà unifiée).

## 3. Onglet Statistiques — KPI + graphes v2

**Cartes KPI (grid 4 colonnes desktop / 2 mobile)**
- Revenus, Dépenses, Net, Taux d'épargne — tous **hors transferts**.
- Chaque carte : valeur XL + delta vs période précédente (flèche + %) + mini-sparkline 30 pts.
- Période active pilotée par un `PeriodPicker` (7j, 30j, Ce mois, Mois dernier, YTD, Perso).

**Graphes**
- `CashFlowChart` — aires empilées Revenus/Dépenses + ligne Net, avec ligne pointillée pour la période précédente (comparaison).
- `CategoryBreakdown` — donut interactif avec drill-down (clic = filtre liste).
- `TopMerchants` — barres horizontales top 8 descriptions récurrentes.
- `HeatmapCalendar` — intensité des dépenses jour par jour (30/90j).

Tous les graphes s'appuient sur `transactionMath.ts` — aucune duplication.

## 4. Formulaire de saisie — v2

`TransactionForm.tsx` retravaillé :
- **Layout 2 colonnes desktop** : à gauche saisie principale (type/montant/description/date), à droite contexte (compte, catégorie, tags, notes, pièce jointe).
- **Champ montant** : gros clavier calculette optionnel (mobile) avec opérations simples (`+ - × ÷`), formatage live avec séparateur milliers.
- **Sélecteur catégorie** : grille avec icônes, catégories favorites/récentes en tête, recherche instantanée.
- **Sélecteur compte** : liste avec solde actuel affiché.
- **Onglet Transfert** : source + destination côte à côte, prévisualisation "Nouveau solde" pour les deux comptes.
- **Validation inline** par champ (déjà en place) — on ajoute des messages spécifiques et un résumé en bas quand plusieurs erreurs.
- **Raccourcis** : `Cmd+Enter` = enregistrer, `Cmd+Shift+Enter` = enregistrer & nouveau, `Tab` optimisé.
- Mode "Saisie rapide" (déjà existant) préservé.

## 5. Sous-pages du module

**Charges récurrentes (`RecurringPage`)**
- Header aligné sur `PageHeader` avec KPI : Total mensuel, Prochaines 7j, Actives, En pause.
- Cartes récurrentes avec countdown "Dans X jours" + badge statut.
- Actions rapides : Exécuter maintenant, Suspendre, Éditer.

**Reçus (`ReceiptsPage`)**
- Vue grille (miniatures) + vue liste, toggle mémorisé.
- Filtres : par période, par plan payé, par méthode.
- Bouton "Télécharger PDF" homogène avec la génération existante.

## 6. Fichiers touchés (résumé technique)

Nouveaux :
- `src/lib/transactionMath.ts`
- `src/components/dashboard/transactions/SmartSearchInput.tsx`
- `src/components/dashboard/transactions/SavedViewsMenu.tsx`
- `src/components/dashboard/transactions/PeriodPicker.tsx`
- `src/components/dashboard/transactions/charts/CashFlowChart.tsx`
- `src/components/dashboard/transactions/charts/CategoryBreakdown.tsx`
- `src/components/dashboard/transactions/charts/TopMerchants.tsx`
- `src/components/dashboard/transactions/charts/HeatmapCalendar.tsx`
- `src/components/dashboard/transactions/form/AmountCalculator.tsx`
- `src/components/dashboard/transactions/form/CategoryGrid.tsx`

Modifiés :
- `src/pages/dashboard/TransactionsPage.tsx` (recomposition Gestion + Stats)
- `src/pages/dashboard/RecurringPage.tsx`
- `src/pages/dashboard/ReceiptsPage.tsx`
- `src/components/transactions/TransactionForm.tsx`
- `src/components/dashboard/transactions/TransactionsHeroHeader.tsx`
- `src/components/dashboard/transactions/TransactionInsightsBar.tsx`
- `src/components/dashboard/transactions/TransactionList.tsx`
- `src/components/dashboard/transactions/AdvancedFiltersSheet.tsx`
- `src/hooks/useSavedFilters.ts` (si absent, création)

## 7. Livraison en 3 vagues

1. **Fondation** — `transactionMath.ts` + application aux KPI/insights/liste (calculs justes hors transferts).
2. **Gestion v2** — recherche avancée + vues sauvegardées + densité + tri.
3. **Stats v2 + Formulaire v2 + sous-pages** — graphes, PeriodPicker, formulaire 2 colonnes, Recurring/Receipts harmonisés.

Chaque vague est indépendante et testable en preview avant la suivante.
