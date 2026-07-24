# Refonte page Transactions — Ivory Dense

Direction choisie : **Ivory premium clair** (fond ivoire, encre noire, accent ambre `#B45309`), typo **Urbanist + Epilogue**, layout **dashboard dense** (sidebar filtres à gauche + zone principale KPI + tableau maître).

## Ce qui change visuellement

- **Palette locale scoped à la page** (`.tx-ivory`) : ivoire `#F7F5F0`, surface `#EDE8DC`, ligne `#DCD7CB`, encre `#1A1A1A`, accent ambre `#B45309`, succès émeraude, transferts neutres. Le reste de l'app reste en thème sombre.
- **Typo dédiée** : Urbanist pour titres et montants, Epilogue pour texte courant, chargée depuis Google Fonts dans la page.
- **Hero compact** : titre "Transactions" + barre de recherche pill + bouton primaire "Nouvelle". Trois cartes KPI (Solde, Entrées période, Sorties période). Puce insight sombre (top dépense) + puce ivoire (top catégorie / alerte).
- **Sidebar filtres** (persistante desktop, drawer mobile) : Période (chips Aujourd'hui/Semaine/Mois/Personnalisé), Type (Toutes / Revenus / Dépenses / Transferts), Comptes (liste avec compteurs), Catégories (liste avec compteurs), montant min/max, tags, bouton "Réinitialiser".
- **Tableau maître dense** : colonnes Date · Libellé · Catégorie · Compte · Statut · Montant. Groupement par jour avec en-tête de section + sous-total quotidien. Sticky header. Hover surbrillance ivoire. Status pastille couleur (effectué / en cours / transfert).
- **Barre bulk sticky bas** quand sélection : Modifier · Dupliquer · CSV · Excel · Supprimer.
- **Pagination** en pied, format éditorial (Page x / y · n résultats).

## Ce qui NE change PAS

- Logique métier (RPC, transferts, quotas plan gratuit, détection doublons, RLS).
- Formulaires TransactionForm et TransferDialog (déjà unifiés).
- Composants réutilisables (`BulkActionBar`, `useBulkSelection`, `usePersistedState`, `transactionMath`, insights IA).
- Sidebar globale de l'app, breadcrumbs, cloche, thème global.

## Fichiers touchés

```text
src/index.css                                    + tokens .tx-ivory (scope local)
src/pages/dashboard/TransactionsPage.tsx         restructuration layout (sidebar + main)
src/components/dashboard/transactions/
  ├── TransactionsHeroHeader.tsx                 refonte KPI + recherche + insights
  ├── TransactionList.tsx                        mode "dense table" (colonne Statut, sous-totaux jour)
  ├── TransactionInsightsBar.tsx                 chips ivory (top dép/cat/variation)
  └── TransactionsFiltersSidebar.tsx  (NEW)      sidebar filtres persistants
```

## Détails techniques

- Tokens ivoire déclarés dans `:root .tx-ivory { --tx-bg: 45 33% 96%; ... }` en HSL pour rester compatible Tailwind. Aucune valeur hex en dur dans les composants, uniquement des classes `bg-[hsl(var(--tx-bg))]`.
- Wrapper `<div className="tx-ivory">` autour de la page uniquement — le shell (sidebar app + topbar) reste inchangé.
- Sidebar filtres = composant `<TransactionsFiltersSidebar />` desktop (`lg:block w-64 shrink-0`) + Sheet drawer mobile réutilisant `MobileNavDrawer` pattern.
- Tableau : réutiliser TransactionList existant, ajouter une prop `variant="dense-table"` qui rend `<table>` HTML avec `<thead sticky>` et en-têtes de jour en `<tr class="section-row">`.
- Chips insights : réutiliser sortie `TransactionInsightsBar` mais reskin avec bg noir + ivoire (via tokens).
- Persistance des filtres : déjà en place via `usePersistedState`, on branche juste la nouvelle sidebar dessus.

## Sortie attendue

Une page Transactions en clair, éditoriale et dense, avec sidebar filtres persistante à gauche, KPI compacts en haut, tableau maître large, actions bulk cohérentes, sans régression fonctionnelle. Le reste de l'app reste inchangé.
