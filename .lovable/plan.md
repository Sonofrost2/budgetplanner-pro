

# Audit complementaire -- Analyses approfondies

---

## 4. SECURITE ET INTEGRITE DES DONNEES

### Edge Functions sans authentification
Les 4 edge functions (`ai-forecast`, `ai-suggest`, `paydunya-checkout`, `send-payment-confirmation`) ont `verify_jwt = false` dans `config.toml`. N'importe qui peut les appeler sans etre authentifie. `ai-forecast` et `ai-suggest` consomment des credits API Lovable AI sans controle. Un attaquant pourrait epuiser les credits en spammant ces endpoints.

**Proposition** : Activer `verify_jwt = true` sur `ai-forecast` et `ai-suggest`, et valider le `user_id` cote serveur via le token JWT au lieu de faire confiance au body.

### Donnees sensibles dans les requetes IA
`ai-forecast` envoie l'integralite des transactions brutes (montants, descriptions, dates) a l'API IA sans anonymisation. Les descriptions peuvent contenir des informations personnelles (noms, adresses, numeros de telephone).

**Proposition** : Anonymiser les descriptions avant envoi (remplacer par des categories generiques) ou au minimum ne pas envoyer les champs `description` et `notes`.

### Suppression de compte sans cascade
- Supprimer un `payment_account` ne supprime pas les transactions liees (pas de `ON DELETE CASCADE` dans le schema). Les transactions orphelines faussent les rapports.
- Supprimer une `category` ne reassigne pas les transactions qui l'utilisent. Les transactions perdent leur categorisation.

**Proposition** : Ajouter `ON DELETE SET NULL` sur `transactions.account_id` et `transactions.category_id`, ou bloquer la suppression si des transactions existent.

### Transferts non atomiques
Le `TransferDialog` fait 4 requetes sequentielles (insert expense, insert income, update link 1, update link 2). Si une echoue a mi-chemin, les donnees deviennent inconsistantes (argent cree ou detruit).

**Proposition** : Creer une fonction SQL `perform_transfer(from_id, to_id, amount, desc, user_id)` qui fait tout dans une transaction atomique.

---

## 5. GESTION D'ERREURS ET RESILIENCE

### Aucun retry/fallback sur les requetes
Toutes les requetes Supabase echouent silencieusement (console.error seulement). L'utilisateur voit des listes vides sans savoir qu'il y a eu une erreur reseau.

**Proposition** : Afficher un message d'erreur avec bouton "Reessayer" quand une requete echoue. Avec React Query, les retries automatiques seraient natifs.

### Pas de gestion du mode hors-ligne
L'app est une PWA (`vite-plugin-pwa` installe) mais ne gere pas le mode hors-ligne. Aucun service worker configure pour cacher les donnees, aucune indication visuelle quand la connexion est perdue.

**Proposition** : Configurer le service worker pour cacher les assets statiques. Ajouter un bandeau "Hors-ligne" quand `navigator.onLine` est false. Cacher les dernieres donnees consultees dans IndexedDB.

### Edge functions sans timeout client
Les appels a `ai-forecast` et `ai-suggest` n'ont pas de timeout cote client. Si l'IA met 60s a repondre, l'utilisateur reste bloque sur le spinner sans limite.

**Proposition** : Ajouter un `AbortController` avec timeout de 30s + message "La requete a pris trop de temps".

---

## 6. COHERENCE ET LOGIQUE METIER APPROFONDIE

### Solde theorique incomplet (AccountsPage)
`getTheoreticalBalance` (ligne 65-70) calcule `income - expense` SANS ajouter `opening_balance`. Le solde theorique affiche est donc systematiquement incorrect pour tous les comptes ayant un solde d'ouverture.

```text
Actuel:     theorique = sum(income) - sum(expense)
Correct:    theorique = opening_balance + sum(income) - sum(expense)
```

**Proposition** : Ajouter `opening_balance` dans le calcul. Verifier que les transactions de "Solde de debut" ne doublent pas le calcul.

### Budgets : filtre temporel ignore le `period`
`BudgetsPage` (lignes 48-52) filtre TOUJOURS les depenses du mois courant, quel que soit le `period` du budget :
- Un budget `weekly` affiche les depenses du mois entier (surestimation)
- Un budget `yearly` affiche les depenses du mois seulement (sous-estimation)

**Proposition** : Calculer le `start/end` en fonction du `period` de chaque budget individuellement.

### Epargne deconnectee des comptes
`SavingsPage.handleAddAmount` (lignes 60-72) incremente `current_amount` sur le `savings_goal` mais :
1. Ne cree aucune transaction sur le `account_id` lie
2. Ne debite aucun compte source
3. L'epargne est "virtuelle" -- elle n'impacte pas les soldes reels

**Proposition** : Quand on ajoute de l'epargne liee a un compte, demander le compte source et creer un transfert automatique (expense sur source + income sur compte epargne), ou au minimum creer une transaction.

### Limite de 1000 lignes non geree
`TransactionsPage.fetchData` (ligne 75) et `AccountsPage.fetchData` (ligne 56) font des `select(*)` sans `.range()`. Avec 35 comptes actifs, l'utilisateur atteindra facilement 1000+ transactions en quelques mois. Les donnees seront silencieusement tronquees.

**Proposition** : Implementer la pagination serveur avec `.range(from, to)` et un compteur total avec `.count()`.

### Calcul du solde reel via requete complete
`updateAccountBalance` dans `TransactionsPage` et `TransferDialog` re-selectionne TOUTES les transactions du compte pour recalculer le solde. Avec beaucoup de transactions, c'est O(n) a chaque operation.

**Proposition** : Utiliser une fonction SQL `UPDATE payment_accounts SET real_balance = opening_balance + COALESCE((SELECT SUM(CASE WHEN type='income' THEN amount ELSE -amount END) FROM transactions WHERE account_id = $1), 0) WHERE id = $1`.

---

## 7. UX MOBILE ET ACCESSIBILITE

### Navigation avec 35 comptes
Les Select de comptes (transferts, transactions, objectifs d'epargne) affichent 35 comptes dans un dropdown sans recherche. Sur mobile, c'est quasi-inutilisable.

**Proposition** : Utiliser un Combobox (`cmdk`, deja installe) avec recherche pour les selecteurs de comptes. Grouper par type (Banque, Mobile Money, Epargne, etc.).

### Pas de raccourcis clavier
Aucun raccourci clavier dans l'app (ex: `Ctrl+N` pour nouvelle transaction, `Escape` pour fermer les dialogs, etc.).

**Proposition** : Ajouter des raccourcis pour les actions frequentes.

### Sidebar ne se ferme pas au tap sur le contenu mobile
Sur mobile, la sidebar se ferme via l'overlay mais pas via swipe. Pas de geste tactile.

### Contraste des labels
Les labels `text-[10px]` et `text-muted-foreground/50` (sidebar, cards) peuvent avoir un ratio de contraste insuffisant pour l'accessibilite WCAG AA.

**Proposition** : Augmenter la taille minimale a 11px et le contraste a `text-muted-foreground/70`.

---

## 8. ARCHITECTURE ET DETTE TECHNIQUE

### Typage faible (`any` partout)
Quasiment toutes les donnees sont typees `any[]` (transactions, accounts, budgets, goals, categories). Aucune interface TypeScript definissant les shapes des donnees.

**Proposition** : Creer des interfaces TypeScript dans un fichier `src/types/` et utiliser les types generes par Supabase (`Database['public']['Tables']`).

### Duplication de logique
- `updateAccountBalance` est dupliquee dans `TransactionsPage`, `TransferDialog`, et probablement DashboardHome.
- Le formatage des dates (`locale === 'fr' ? 'fr-FR' : 'en-US'`) est repete 20+ fois.
- Le pattern `style={{ background: 'var(--gradient-primary)' }}` est copie sur chaque bouton primaire.

**Proposition** : Extraire `updateAccountBalance` dans un hook `useAccountBalance`. Creer un utilitaire `getLocaleStr(locale)`. Creer un composant `GradientButton`.

### Pas de tests
Un seul fichier `example.test.ts` existe. Aucun test unitaire, d'integration, ou e2e.

**Proposition** : Ajouter des tests pour les calculs critiques (soldes, budgets, transferts) et les hooks principaux.

### `allTransactions` inutilise dans DashboardHome
La variable `allTransactions` (ligne 51 du DashboardHome) est fetchee et stockee mais jamais utilisee dans le rendu.

**Proposition** : Supprimer la requete inutile (economie d'une requete reseau).

---

## 9. MODULE PAIEMENT / ABONNEMENT

### Pas de verification serveur du statut d'abonnement
`useSubscription` verifie le plan cote client en lisant la table `subscriptions`. Un utilisateur peut modifier le code client ou manipuler les donnees pour contourner les limites (nombre de transactions, acces aux previsions, etc.).

**Proposition** : Verifier les limites cote serveur (RLS policies ou edge function) avant chaque operation restreinte.

### Pas de renouvellement automatique fonctionnel
L'edge function `subscription-renew` existe mais il n'y a aucun cron job ou webhook configure pour la declencher. Les abonnements ne se renouvellent pas automatiquement.

### PayDunya sans webhook de confirmation
`paydunya-checkout` cree un checkout mais il n'y a pas de webhook pour confirmer le paiement. Le statut de l'abonnement pourrait ne jamais passer a "active" apres un paiement reussi.

---

## 10. LANDING PAGE ET ONBOARDING

### Onboarding minimal
La page d'onboarding collecte probablement le nom et la devise, mais ne propose pas de creer les premiers comptes ou categories. L'utilisateur arrive sur un dashboard completement vide.

**Proposition** : Ajouter des etapes "Creer votre premier compte" et "Choisir vos categories" dans le flow d'onboarding. Proposer des templates de categories predefinies (alimentation, transport, logement, etc.).

### Pas de protection des routes
`DashboardLayout` redirige vers `/login` si pas authentifie, mais ce n'est pas un vrai guard. Pendant le chargement, le contenu du dashboard peut flasher brievement.

---

## RESUME DES PRIORITES AJOUTEES

| # | Sujet | Severite |
|---|-------|----------|
| S1 | Edge functions sans JWT (securite + couts) | Critique |
| S2 | Transferts non atomiques | Critique |
| S3 | Solde theorique sans opening_balance | Haute |
| S4 | Budgets : filtre temporel ignore period | Haute |
| S5 | Limite 1000 lignes | Haute |
| S6 | Epargne deconnectee des comptes | Haute |
| S7 | Typage `any` partout | Moyenne |
| S8 | Pas de gestion hors-ligne (PWA) | Moyenne |
| S9 | Verification abonnement cote client seulement | Moyenne |
| S10 | Suppression cascade manquante | Moyenne |
| S11 | Duplication logique (updateAccountBalance, dates) | Moyenne |
| S12 | Select de comptes sans recherche (35 comptes) | Moyenne |
| S13 | Pas de tests | Basse |
| S14 | Onboarding minimal | Basse |

