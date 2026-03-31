

# Audit complet de Budget Planner Pro — Tous les modules, pages, vues, listes, tabs et formulaires

---

## 1. Dashboard Home (`DashboardHome.tsx` — 429 lignes)

### Vues & Widgets
- **OK** : Bento grid drag & drop, 10 widgets configurables, selecteur de periode, comparaison N-1
- **Probleme** : Pas d'etat vide engageant pour les nouveaux utilisateurs (aucun onboarding contextuel)
- **Probleme** : Le WeeklyPlannerWidget charge toutes les transactions de l'annee
- **Amelioration** : Ajouter un "Quick Actions" flottant (raccourcis: ajouter transaction, transfert, valoriser actif)
- **Amelioration** : Ajouter un message d'accueil contextuel pour les comptes vides ("Commencez par creer un compte")

### Widget Patrimoine (`WealthWidget.tsx`)
- **OK** : Valeur nette, plus-value, mini donut
- **Probleme** : Fait 3 requetes independantes (assets, savings, debts) — devrait utiliser un hook consolide
- **Amelioration** : Ajouter un mini sparkline d'evolution au lieu du donut seul

---

## 2. Transactions (`TransactionsPage.tsx` — 999 lignes)

### Liste
- **OK** : Pagination server-side, tri, filtres, bulk actions, regroupement par date, deep-linking
- **Probleme** : Le fichier reste monolithique malgre l'extraction de `TransactionForm`
- **Amelioration** : Extraire `TransactionListItem` et `TransactionBulkActions` en sous-composants
- **Amelioration** : Ajouter swipe-to-edit/delete sur mobile (touch gestures)

### Formulaire (`TransactionForm.tsx`)
- **OK** : Validation avec messages d'erreur, suggestions historiques, suggestions IA, combobox categories/comptes
- **Probleme** : Le champ `notes` n'est pas marque "(optionnel)"
- **Amelioration** : Ajouter un mode "saisie rapide" (inline dans la liste sans ouvrir le dialogue)

### Tabs
- **Tab Statistiques** (`TransactionsStatsTab`) : OK — graphiques et repartition
- **Amelioration** : Ajouter un tab "Import" pour importer des transactions depuis CSV

---

## 3. Budgets (`BudgetsPage.tsx` — 755 lignes)

### Liste
- **OK** : Filtres, recherche, tri, bulk actions, progression visuelle
- **Probleme** : Un budget sans `budget_type` serait classe comme depense par defaut (filtre `!== 'income'`)
- **Amelioration** : Ajouter un code couleur dynamique sur la barre de progression (vert → jaune → rouge selon le %)

### Formulaire (`BudgetForm.tsx`)
- **OK** : Validation robuste, champs conditionnels, combobox categorie
- **Probleme** : Le champ `reference_date` apparait sans explication de son utilite
- **Amelioration** : Ajouter un tooltip explicatif sur `reference_date` et `occurrence_frequency`

### Tabs
- **Tab Gestion** : Liste des budgets — OK
- **Tab Evolution** (`BudgetEvolutionTab`) : Graphique d'evolution — OK
- **Tab Analyse** (`BudgetAnalysisTab`) : Comparaison — OK
- **Amelioration** : Ajouter un tab "Suggestions IA" avec les recommandations budgetaires personnalisees

---

## 4. Comptes (`AccountsPage.tsx` — 709 lignes)

### Liste
- **OK** : Filtres, transferts, arquets de caisse, historique, stats periode, bulk actions
- **OK** : Migration vers React Query realisee (useAccounts, useAccountTheoreticalBalances)
- **Amelioration** : Ajouter un mini graphique d'evolution du solde par compte (sparkline dans la carte)

### Formulaire
- **OK** : Validation avec messages d'erreur, types de comptes, icones selectionnables
- **Probleme** : Le champ `opening_balance` affiche une erreur pour les negatifs mais les decouverts sont valides
- **Amelioration** : Permettre les soldes negatifs avec un warning au lieu d'une erreur

### Tabs
- **Tab Comptes** : Liste — OK
- **Tab Recapitulatif** (`AccountsRecapTab`) : Stats par periode — OK
- **Amelioration** : Ajouter un tab "Evolution" avec graphique des soldes dans le temps

---

## 5. Epargne (`SavingsPage.tsx` — 1073 lignes)

### Liste
- **OK** : Objectifs avec progression, contributions, simulation IA, verrouillage, interets, stats globales
- **Probleme** : Fichier le plus gros de l'app (1073 lignes) — extraire les dialogues et sous-composants
- **Amelioration** : Animation confetti/celebration quand un objectif atteint 100%
- **Amelioration** : Notification push quand `goal_reached` (le champ existe dans les preferences mais n'est pas utilise)

### Formulaire
- **Probleme** : 12+ champs affiches simultanement sans groupement
- **Amelioration** : Grouper en sections collapsibles (Base: nom/cible/delai, Avance: taux/frequence/contribution, Banque: nom banque/jour)
- **Amelioration** : Ajouter des valeurs par defaut intelligentes (contribution = cible / mois restants)

### Tabs
- **Tab Objectifs** : Cartes d'objectifs — OK (composant `SavingsGoalCard` extrait)
- **Tab Projections** (`SavingsProjectionsTab`) : OK
- **Tab Evolution** (`SavingsEvolutionTab`) : OK
- **Tab Resume** : Tableaux recapitulatifs — OK
- **Tab Controle** : Table de suivi — OK

---

## 6. Patrimoine (`WealthPage.tsx` — 879 lignes)

### Vue d'ensemble
- **OK** : KPIs (valeur nette, actifs, epargne, dettes), donut de repartition, top actifs, projections 5 ans
- **OK** : Export PDF et Excel, suggestions IA de valorisation, historique par actif
- **Probleme** : Pas de bulk actions (supprimer/modifier plusieurs actifs)
- **Amelioration** : Ajouter bulk actions comme les autres modules
- **Amelioration** : Ajouter un indicateur de "sante du patrimoine" (diversification, ratio dettes/actifs)

### Formulaire actif
- **OK** : Types, categories dynamiques, icones, localisation, notes
- **Probleme** : Validation minimale (seulement nom + valeur > 0, pas de messages d'erreur inline)
- **Amelioration** : Ajouter une validation complete avec `setErrors` et messages inline comme les autres modules
- **Amelioration** : Ajouter un apercu en temps reel de la carte de l'actif dans le formulaire

### Formulaire valorisation
- **OK** : Valeur, date, notes
- **Probleme** : Pas de validation de la date (peut etre dans le futur)
- **Amelioration** : Limiter la date a aujourd'hui maximum

### Tabs
- **Tab Vue d'ensemble** : Donut + top actifs — OK
- **Tab Mes actifs** : Grille filtrable — OK
- **Tab Evolution** : Graphiques + projections — OK
- **Amelioration** : Ajouter un tab "Analyse" avec ratio de diversification, rendement par type, comparaison annuelle

---

## 7. Categories (`CategoriesPage.tsx` — 323 lignes)

### Liste
- **OK** : CRUD, bulk actions, filtres, evolution chart, compteur de transactions
- **Amelioration** : Ajouter un apercu preview de l'icone + couleur choisies dans la carte
- **Amelioration** : Valider l'unicite du nom de categorie avant la sauvegarde

### Formulaire
- **OK** : Validation avec messages d'erreur inline
- **Probleme** : Pas de preview en temps reel de l'icone + couleur ensemble
- **Amelioration** : Ajouter un mini apercu de la categorie (icone sur fond couleur) a cote du formulaire

### Tabs
- **Tab Gestion** : Liste — OK
- **Tab Evolution** (`CategoryEvolutionChart`) : Graphique — OK

---

## 8. Dettes (`DebtsPage.tsx` — 383 lignes)

### Liste
- **OK** : CRUD, paiements partiels, plan IA, recherche, filtres par statut, export CSV/Excel
- **Probleme** : Pas de bulk actions (contrairement aux autres modules)
- **Probleme** : Un paiement de dette ne cree pas de transaction correspondante (pas de lien)
- **Amelioration** : Ajouter bulk actions (supprimer/marquer paye en masse)
- **Amelioration** : Option de lier un paiement de dette a une transaction automatiquement
- **Amelioration** : Ajouter un calendrier visuel des echeances a venir

### Formulaire
- **OK** : Validation complete avec messages d'erreur inline (ameliore depuis l'audit initial)
- **Amelioration** : Ajouter un champ "taux d'interet" et calcul automatique du cout total

---

## 9. Recurrences (`RecurringPage.tsx` — 514 lignes)

### Liste
- **OK** : Detection IA, filtres par type/frequence, tri, tabs confirme/detecte
- **Probleme** : Pas de bulk actions
- **Amelioration** : Ajouter bulk actions (activer/desactiver/supprimer en masse)
- **Amelioration** : Ajouter un calendrier visuel des prochaines echeances
- **Amelioration** : Notification push pour les echeances a venir (preference `recurring_reminders` existe mais n'est pas implementee)

### Formulaire
- **OK** : Validation avec messages d'erreur inline
- **Probleme** : Le champ `next_date` n'a pas de valeur par defaut
- **Amelioration** : Pre-remplir `next_date` avec la date du jour

---

## 10. Rapports (`ReportsPage.tsx` — 241 lignes)

### Vues
- **OK** : 6 tabs (IA, mensuel, categories, cash flow, budget vs actual, journal), selecteur de periode
- **Amelioration** : Ajouter un rapport "Tendances" avec comparaison mois-sur-mois
- **Amelioration** : Ajouter un rapport "Patrimoine" qui reprend les donnees du module Wealth

### Tabs
- **Tab Synthese IA** (`AIInsightsReport`) : OK
- **Tab Mensuel** : Graphique barres — OK
- **Tab Categories** : Camembert — OK
- **Tab Cash Flow** (`CashFlowReport`) : OK
- **Tab Budget vs Reel** (`BudgetVsActualReport`) : OK
- **Tab Journal** (`DailyJournalReport`) : OK

---

## 11. Previsions (`ForecastsPage.tsx` — 545 lignes)

### Vues
- **OK** : Health gauge, projections, recommandations IA, graphiques
- **Probleme** : Pas de cache pour les resultats IA (chaque visite relance l'analyse complete)
- **Amelioration** : Cacher le resultat IA en localStorage avec TTL de 24h
- **Amelioration** : Ajouter un bouton "Rafraichir l'analyse" au lieu de relancer automatiquement

---

## 12. Famille (`FamilyPage.tsx` — 415 lignes)

### Vues
- **OK** : Groupes, invitations, budgets partages, transactions des membres
- **Probleme** : Utilise `fetchData` manuel (useState + useEffect) au lieu de React Query
- **Amelioration** : Migrer vers React Query pour le cache et la revalidation
- **Amelioration** : Ajouter un resume des contributions par membre (qui depense quoi)
- **Amelioration** : Ajouter recherche/filtre dans les transactions partagees

### Formulaires
- **Probleme** : Validation minimale (pas de messages d'erreur inline sur les formulaires de creation de groupe et d'invitation)
- **Amelioration** : Ajouter validation email + messages d'erreur inline

---

## 13. Recus (`ReceiptsPage.tsx` — 160 lignes)

### Liste
- **OK** : Recherche, filtres par statut, export CSV/Excel, impression
- **Probleme** : Pas de pagination (tous les recus charges)
- **Amelioration** : Ajouter la pagination si le nombre de recus est eleve
- **Amelioration** : Ajouter le telechargement PDF individuel (comme PaymentPage)

---

## 14. Parametres (`SettingsPage.tsx` — 316 lignes)

### Sections
- **OK** : Profil (nom, devise, langue), securite (mot de passe), donnees (export, suppression)
- **OK** : Preferences de notifications (`NotificationPreferencesCard`)
- **Probleme** : Mot de passe minimum 6 caracteres — devrait etre 8 minimum
- **Probleme** : Pas de section "Apparence" (le theme est dans la sidebar mais pas dans les parametres)
- **Amelioration** : Regrouper theme + apparence dans les parametres
- **Amelioration** : Ajouter un bouton "Notification de test" dans les preferences
- **Amelioration** : Ajouter l'upload d'avatar (le champ `avatar_url` existe en DB mais n'est pas utilise dans le formulaire)

---

## 15. Paiement (`PaymentPage.tsx` — 538 lignes)

### Vues
- **OK** : Plans, checkout PayDunya, generation de recu PDF, historique
- **Amelioration** : Ajouter un comparatif visuel des plans (tableau feature-par-feature)
- **Amelioration** : Ajouter un badge "Populaire" sur le plan recommande

---

## 16. Guide (`GuidePage.tsx` — 156 lignes)

### Vues
- **OK** : Guides par module, FAQ, tutoriel pas-a-pas
- **Probleme** : Pas de guide pour le module Patrimoine (Wealth) — manquant
- **Amelioration** : Ajouter le guide Patrimoine + FAQ correspondante
- **Amelioration** : Ajouter des videos courtes ou GIFs animes pour illustrer les tutoriels

---

## 17. Onboarding (`OnboardingPage.tsx` — 436 lignes)

### Formulaire
- **OK** : 6 etapes (bienvenue, plan, preferences, comptes, paiement, termine)
- **Amelioration** : Ajouter une etape "Premiere transaction" pour guider la saisie initiale
- **Amelioration** : Ajouter une etape "Patrimoine" pour les actifs existants

---

## 18. Admin Pricing (`AdminPricingPage.tsx` — 159 lignes)

### Formulaire
- **OK** : Edition des plans, prix multi-devises, fonctionnalites
- **Amelioration** : Ajouter la creation de nouveaux plans (actuellement edition seulement)
- **Amelioration** : Ajouter la suppression de plans

---

## 19. Navigation

### Sidebar Desktop (`AppSidebar.tsx` — 365 lignes)
- **OK** : 3 groupes (Principal, Gestion, Analyse), profil, theme, recherche, admin
- **OK** : Dettes, Recurrences, Patrimoine presents dans la sidebar

### Mobile Bottom Nav (`MobileBottomNav.tsx` — 162 lignes)
- **OK** : 4 tabs + menu "Plus" avec tous les modules
- **Amelioration** : Ajouter un badge de notification sur l'onglet correspondant (ex: alertes budget)

### Layout (`DashboardLayout.tsx`)
- **OK** : Loading spinner, recherche globale (Cmd+K), notifications, offline banner, PWA update
- **Amelioration** : Ajouter un breadcrumb pour indiquer la page active

---

## 20. Problemes transversaux

### Performance
| Probleme | Module | Action |
|---|---|---|
| WeeklyPlanner charge toutes les TX de l'annee | DashboardHome | Limiter au mois courant |
| WealthWidget fait 3 requetes independantes | DashboardHome | Consolider en un seul hook |
| ForecastsPage relance l'IA a chaque visite | Forecasts | Cache localStorage 24h |
| FamilyPage utilise useState au lieu de React Query | Family | Migrer vers React Query |

### Validation des formulaires
| Module | Niveau actuel | Action |
|---|---|---|
| Transactions | Complet | OK |
| Budgets | Complet | OK |
| Comptes | Complet | Permettre negatifs |
| Epargne | Partiel | Grouper en sections |
| Patrimoine | Minimal | Ajouter validation inline |
| Dettes | Complet | OK |
| Recurrences | Complet | Pre-remplir next_date |
| Categories | Complet | Ajouter preview |
| Famille | Minimal | Ajouter validation email |

### Securite
- Trigger `notify_on_transaction_insert` contient la **cle anon en dur** dans le SQL
- Mot de passe minimum 6 caracteres → passer a 8
- Pas de rate limiting client-side sur les formulaires Login/Signup

---

## Plan d'implementation par priorite

### Phase 1 — Corrections rapides
1. Validation inline complete pour WealthPage (formulaire actif)
2. Pre-remplir `next_date` dans RecurringPage
3. Ajouter le guide Patrimoine dans GuidePage
4. Mot de passe minimum 8 caracteres
5. Marquer les champs optionnels "(optionnel)" dans tous les formulaires

### Phase 2 — UX amelioree
6. Sections collapsibles dans le formulaire Epargne
7. Bulk actions pour Dettes, Recurrences, Patrimoine
8. Cache localStorage pour les resultats IA des Previsions
9. Upload d'avatar dans les Parametres
10. Breadcrumb dans le layout

### Phase 3 — Fonctionnalites avancees
11. Tab "Analyse" dans le module Patrimoine (diversification, rendement)
12. Rapport Patrimoine dans ReportsPage
13. Lien automatique paiement dette → transaction
14. Notifications push pour recurrences et objectifs epargne atteints
15. Migration FamilyPage vers React Query

### Phase 4 — Refactoring
16. Extraire SavingsPage en sous-composants (1073 lignes → ~5 fichiers)
17. Extraire TransactionListItem et TransactionBulkActions
18. Consolider les requetes du WealthWidget en un seul hook

