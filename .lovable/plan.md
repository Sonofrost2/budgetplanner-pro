# Plan : Refonte du module Transactions — Liste, interface et UX

## Problèmes identifiés

1. **TransactionsPage.tsx** reste monolithique (999 lignes) — la liste inline n'utilise pas le composant `TransactionList.tsx` déjà extrait
2. **Pas de regroupement par date** dans la page principale (le composant `TransactionList` le fait mais n'est pas utilisé)
3. **Boutons d'actions toujours visibles** sur mobile (pas de swipe, pas d'actions contextuelles adaptées)
4. **Pas de résumé rapide** des revenus/dépenses filtrés en haut de la liste
5. **Pagination basique** — pas de numéros de page, pas de saut rapide
6. **TransactionFilters.tsx** existe mais n'est pas utilisé (la page a ses propres filtres inline)
7. **Pas de vue condensée** pour afficher plus de transactions

## Améliorations prévues

### A. Extraction & refactoring du code

- Extraire la liste de transactions (lignes 740-883) vers `TransactionList.tsx` mis à jour avec regroupement par date
- Extraire les dialogs bulk (modify, overspend) dans un fichier `TransactionDialogs.tsx`
- Réduire `TransactionsPage.tsx` de ~999 à ~500 lignes

### B. Liste améliorée (`TransactionList.tsx`)

- **Regroupement par date** avec séparateurs sticky (Aujourd'hui, Hier, date complète) + somme du jour
- **Résumé rapide** au-dessus de la liste : total revenus / total dépenses / solde net pour la page affichée
- **Actions au survol** uniquement sur desktop (opacity-0 → group-hover) — déjà fait
- **Sur mobile** : afficher un bouton menu contextuel (3 dots) au lieu des 2 icônes
- **Indicateur de type coloré** (dot vert/rouge sur l'icône catégorie) — déjà fait, conserver
- **Pagination améliorée** : afficher les numéros de page (max 5 visibles) + boutons premier/dernier

### C. Filtres améliorés

- Ajouter un **compteur de résultats par filtre actif** sur les badges type/catégorie/compte
- Ajouter un raccourci **"Ce mois"** et **"Mois dernier"** dans la section dates

### D. Micro-interactions UX

- Animation d'entrée staggerée des lignes (déjà fait via `containerVariants`)
- **Swipe gauche sur mobile** pour révéler les actions (supprimer/éditer) — utiliser touch events
- Feedback haptique visuel au clic sur une transaction (scale pulse)

### E. Résumé en haut de liste

- Mini-bar avec 3 KPIs calculés côté client à partir des transactions de la page :
  - Total revenus (vert)
  - Total dépenses (rouge)  
  - Solde net

## Détails techniques

### Fichiers créés

- `src/components/dashboard/transactions/TransactionDialogs.tsx` — BulkModifyDialog + BudgetOverspendDialog

### Fichiers modifiés

- `src/components/dashboard/transactions/TransactionList.tsx` — Refonte complète :
  - Accepter les mêmes props + ajouter `locale`, `isFetching`
  - Groupement par date avec somme journalière
  - Mini KPI bar (revenus/dépenses/net) 
  - Pagination avec numéros de page
  - Menu contextuel mobile (DropdownMenu avec 3 dots)
  - Swipe-to-action sur mobile via touch events
- `src/pages/dashboard/TransactionsPage.tsx` — Utiliser les composants extraits, réduire à ~500 lignes
- `src/components/dashboard/transactions/TransactionFilters.tsx` — Supprimer (code non utilisé, remplacé par les filtres inline de la page)

### Dépendances

- Aucune nouvelle dépendance requise (framer-motion, lucide-react déjà présents)
- Améliorer le tri des saisies (du plus récent au moins récent en terme de date et heure de saisie)