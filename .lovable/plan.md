

## Refonte des graphiques et statistiques du dashboard

### Problemes identifies (capture d'ecran)

1. **Camembert (Pie chart)** : trop de categories affichees avec labels qui se chevauchent -- completement illisible
2. **Graphique barres (Revenus vs Depenses)** : les montants sur l'axe Y sont des nombres bruts (3000000) sans formatage -- difficile a lire
3. **Cartes statistiques** : manquent de lisibilite pour les grands montants
4. **Memes problemes** dans les onglets Statistiques (TransactionsStatsTab, BudgetAnalysisTab, AccountsRecapTab, SavingsProjectionsTab)

### Plan de refonte

#### 1. ChartsSection.tsx -- Refonte complete

**Pie chart :**
- Grouper les categories au-dela du top 5 dans un "Autres" pour eviter la surcharge
- Supprimer les labels inline du camembert (illisibles quand il y a beaucoup de categories)
- Ajouter une legende cliquable sous le chart avec pourcentages et montants formates
- Augmenter le rayon du donut pour un meilleur rendu visuel

**Area chart (Revenus vs Depenses) :**
- Formater l'axe Y avec un abbreviateur (ex: 1.5M, 250K) au lieu des nombres bruts
- Ajouter une legende coloree sous le graphique
- Ameliorer le tooltip avec un design plus lisible

#### 2. Fonction utilitaire d'abbreviation des montants

Creer un helper `abbreviateNumber` utilise partout :
- `1 500 000` → `1.5M`
- `250 000` → `250K`
- `5 000` → `5K`

#### 3. TransactionsStatsTab.tsx

- Meme regroupement top 5 + "Autres" pour le pie chart
- Legende externe au lieu de labels inline
- Formatter l'axe Y du bar chart

#### 4. AccountsRecapTab.tsx, BudgetAnalysisTab.tsx, SavingsProjectionsTab.tsx

- Formatter les axes Y avec abbreviations
- Ameliorer les tooltips (glass style coherent)
- Ajouter des animations d'entree

#### 5. DashboardHome.tsx -- categoryData

- Appliquer le regroupement top 5 + "Autres" directement dans le `useMemo` qui construit `categoryData`

### Fichiers modifies

- `src/lib/utils.ts` -- ajout `abbreviateNumber`
- `src/components/dashboard/home/ChartsSection.tsx` -- refonte complete
- `src/components/dashboard/tabs/TransactionsStatsTab.tsx` -- meme traitement
- `src/components/dashboard/tabs/AccountsRecapTab.tsx` -- axes formates
- `src/components/dashboard/tabs/BudgetAnalysisTab.tsx` -- axes formates
- `src/components/dashboard/tabs/SavingsProjectionsTab.tsx` -- axes formates
- `src/pages/dashboard/DashboardHome.tsx` -- regroupement categoryData

