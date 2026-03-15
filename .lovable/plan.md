

## Plan de corrections et améliorations — Analyse module par module

### Priorite 1 — Bugs critiques (logique faussee)

**1. Solde d'ouverture comptabilise comme revenu (AccountsPage.tsx, L187-196)**
- A la creation d'un compte, le `opening_balance` est insere comme transaction `income`
- Consequence : les stats du dashboard (revenus, taux d'epargne) sont faussees
- **Correction** : utiliser un type special `opening_balance` au lieu de `income`, ou simplement ne pas creer de transaction du tout (le `recalculate_account_balance` utilise deja `opening_balance + income - expense`, donc la transaction est redondante et fausse le calcul en comptant double)
- Impact : `AccountsPage.tsx` (supprimer l'insert de transaction d'ouverture), `DashboardHome.tsx` et `StatsCards.tsx` (aucun changement necessaire si on supprime la transaction)

**2. Famille : RLS bloque la visibilite des profils des autres membres (FamilyPage.tsx, L70-82)**
- La politique RLS sur `profiles` ne permet que `auth.uid() = user_id`
- Quand on fetch les profils des membres du groupe, seul son propre profil est retourne
- **Correction** : creer une fonction `security definer` `get_family_member_profiles(group_id)` qui verifie l'appartenance au groupe puis retourne les profils des membres, sans modifier la RLS de profiles
- Impact : migration SQL (nouvelle fonction), `FamilyPage.tsx` (utiliser `rpc` au lieu de `select...in`)

**3. Famille : les transactions des membres ne sont pas visibles (FamilyPage.tsx, L102-121)**
- Meme probleme RLS : `transactions` n'est lisible que par son proprietaire
- L'affichage des depenses des membres ne fonctionne pas
- **Correction** : creer une fonction `security definer` `get_family_transactions(group_id, limit)` qui verifie l'appartenance puis retourne les transactions des membres
- Impact : migration SQL, `FamilyPage.tsx`

---

### Priorite 2 — Problemes fonctionnels

**4. Charges recurrentes non executees automatiquement (RecurringPage.tsx)**
- Les transactions recurentes sont definies avec `next_date` mais aucun cron ne les execute
- L'utilisateur doit saisir manuellement chaque echeance
- **Correction** : creer une edge function `process-recurring` + cron job quotidien qui insere les transactions dues et avance `next_date`
- Impact : nouvelle edge function, migration SQL pour le cron, `supabase/config.toml`

**5. Suppression de compte incomplete (SettingsPage.tsx, L116-126)**
- Les donnees sont supprimees mais `auth.users` n'est pas touche — l'email reste bloque
- **Correction** : creer une edge function `delete-account` avec `service_role` qui supprime l'utilisateur de `auth.users` apres nettoyage des donnees
- Impact : nouvelle edge function, `SettingsPage.tsx`

**6. Routes manquantes (App.tsx)**
- `AboutPage.tsx`, `BlogPage.tsx`, `ContactPage.tsx` existent mais ne sont pas routes
- Le footer ne contient pas de liens vers ces pages (il n'y a que privacy/terms/cookies)
- **Correction** : ajouter les routes dans `App.tsx`. Verifier si ces pages sont liees depuis le footer ou la navbar et ajouter les liens si pertinent
- Impact : `App.tsx`, potentiellement `Footer.tsx`

---

### Priorite 3 — Performance et qualite de code

**7. BudgetsPage charge toutes les transactions (BudgetsPage.tsx, L38)**
- `useAllTransactions()` ramene toutes les transactions pour calculer le depense par budget
- Avec beaucoup de donnees, cela devient lent
- **Correction** : creer une requete server-side (RPC ou vue) qui calcule la depense par categorie pour la periode courante, evitant de charger toutes les transactions
- Impact : migration SQL (nouvelle fonction), `BudgetsPage.tsx`, `useDashboardData.tsx`

**8. AccountsPage charge 10000 transactions (AccountsPage.tsx, L114)**
- `supabase.from('transactions').select('type, amount, account_id').limit(10000)` — lourd et potentiellement incomplet
- Le calcul du solde theorique devrait utiliser la fonction serveur ou une vue
- **Correction** : utiliser `recalculate_account_balance` deja existante, et stocker le theoretical balance cote serveur, ou creer un RPC qui retourne les soldes theoriques
- Impact : migration SQL possible, `AccountsPage.tsx`

**9. SavingsPage trop volumineux (818 lignes)**
- Fichier monolithique difficile a maintenir
- **Correction** : extraire les sous-composants (formulaire, simulation, contribution dialog) dans des fichiers separes sous `src/components/dashboard/savings/`
- Impact : `SavingsPage.tsx`, nouveaux fichiers composants

---

### Priorite 4 — UX mineures

**10. Export des donnees ne contient qu'une table (SettingsPage.tsx, L87-113)**
- L'export CSV n'inclut que les transactions, pas les comptes/budgets/epargne malgre le fetch de toutes ces donnees
- **Correction** : generer un ZIP ou plusieurs CSV, un par table

**11. Recu de paiement sans details (ReceiptsPage.tsx)**
- La page est tres basique, pas de possibilite de telecharger/imprimer le recu
- **Correction** : ajouter un bouton de telechargement PDF ou d'impression

---

### Resume des fichiers impactes

| Priorite | Fichiers | Type |
|----------|----------|------|
| P1 | `AccountsPage.tsx` | Correction code |
| P1 | `FamilyPage.tsx` + migration SQL | Correction code + DB |
| P2 | Nouvelle edge function `process-recurring` + cron | Nouveau |
| P2 | Nouvelle edge function `delete-account` + `SettingsPage.tsx` | Nouveau + correction |
| P2 | `App.tsx`, `Footer.tsx` | Correction code |
| P3 | Migration SQL + `BudgetsPage.tsx` | Performance |
| P3 | Migration SQL + `AccountsPage.tsx` | Performance |
| P3 | `SavingsPage.tsx` → composants | Refactoring |
| P4 | `SettingsPage.tsx` | Amelioration |
| P4 | `ReceiptsPage.tsx` | Amelioration |

