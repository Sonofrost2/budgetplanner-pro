

## Analyse UX complète — Point de vue utilisateur

### Problèmes identifiés

**1. Fichier orphelin `CashCountPage.tsx`**
- Existe dans le projet mais n'est ni routé dans `App.tsx`, ni dans la navigation latérale
- Code mort qui crée de la confusion — à supprimer

**2. Le PV d'espèces ne persiste pas correctement**
- Le `CashCountDialog` fait un `UPDATE real_balance` direct sur le compte
- Mais la fonction `recalculate_account_balance` (appelée après chaque transaction) recalcule via `opening_balance + income - expense`, écrasant le résultat du PV
- **Solution** : après un PV, si l'écart est non nul, insérer une transaction d'ajustement automatique (type "income" ou "expense") pour que le solde calculé corresponde au total compté, puis appeler `recalculate_account_balance`

**3. Aucune visibilité sur le dernier PV**
- L'utilisateur fait un PV mais ne voit aucune trace sur la carte du compte
- Pas d'historique accessible depuis la page Comptes
- **Solution** : afficher la date et le montant du dernier PV sous le bouton "PV d'espèces", et ajouter un bouton "Historique" qui ouvre un Sheet avec la liste des PV passés (date, total, écart)

**4. Le bouton "PV d'espèces" n'est pas assez visible**
- Même apparence que "Mettre à jour le solde" des autres comptes — l'utilisateur ne perçoit pas la différence
- **Solution** : ajouter une couleur distinctive (accent) et une icône plus marquée

**5. Pas de confirmation visuelle post-PV**
- Après validation, le toast "Enregistré" est générique — l'utilisateur ne sait pas si le solde a bien changé
- **Solution** : toast plus explicite avec l'ancien et le nouveau solde

### Plan d'implémentation

#### Étape 1 — Supprimer `CashCountPage.tsx`
- Suppression du fichier orphelin

#### Étape 2 — Corriger la persistance dans `CashCountDialog.tsx`
- Après sauvegarde du PV, si `discrepancy ≠ 0` : insérer une transaction d'ajustement (`income` si positif, `expense` si négatif) avec description "Ajustement PV"
- Appeler `recalculate_account_balance` après l'insertion
- Supprimer l'`UPDATE real_balance` direct (le recalcul s'en charge)
- Toast explicite : "Solde mis à jour : X → Y"

#### Étape 3 — Afficher le dernier PV et historique sur `AccountsPage.tsx`
- Fetcher les derniers `cash_counts` groupés par `account_id` au chargement
- Sur chaque carte de compte `cash` : afficher sous le bouton la date et le montant du dernier PV (texte discret)
- Ajouter un bouton "Historique PV" ouvrant un `Sheet` avec liste des PV (date, total compté, attendu, écart, notes)

#### Étape 4 — Traductions
- Ajouter clés : `cashCountAdjustment`, `cashCountHistory`, `lastCount`, `balanceUpdatedFromTo`

#### Fichiers impactés
- **Supprimer** : `src/pages/dashboard/CashCountPage.tsx`
- **Modifier** : `src/components/dashboard/CashCountDialog.tsx`, `src/pages/dashboard/AccountsPage.tsx`, `src/i18n/dashTranslations.ts`

