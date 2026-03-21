
### Objectif
Corriger durablement les 3 points :
1) synchronisation globale (plus besoin de 3-4 reload),  
2) déplacer et améliorer fortement les stats comptes par période dans un onglet dédié,  
3) arrêter tout calcul automatique du solde réel (saisie utilisateur uniquement).

### Constat actuel (code lu)
- La synchro temps réel est quasi absente (seule la partie famille écoute les changements backend), donc certaines vues restent figées jusqu’au reload.
- Le service worker est bien actif mais sans gestion UX explicite de “nouvelle version dispo” (pas de prompt de refresh contrôlé).
- La carte `AccountsPeriodStats` est dans l’onglet “Gestion” de `AccountsPage`, avec filtres limités.
- Le solde réel est recalculé automatiquement via `recalculate_account_balance` dans plusieurs flux :
  - `TransactionsPage.tsx`
  - `SavingsPage.tsx`
  - `CashCountDialog.tsx`
  - backend functions `process-recurring` et `import-journal`
  - fonction SQL `perform_transfer` met aussi à jour `payment_accounts.real_balance`

---

### Plan d’implémentation

## 1) Synchronisation fiable sans rechargements multiples

1. **Mettre en place une synchronisation live centralisée côté dashboard**
   - Créer un hook global de sync (ex. `useRealtimeSync`) branché dans `DashboardLayout`.
   - S’abonner aux changements backend des tables clés (transactions, comptes, budgets, catégories, épargne, dettes, cash_counts, recurring).
   - À chaque événement, invalider les query keys impactées (au lieu d’attendre un reload).

2. **Activer la publication realtime des tables nécessaires**
   - Migration backend pour ajouter ces tables à la publication realtime (actuellement quasi vide).
   - Garder les politiques RLS existantes (pas d’ouverture de droits).

3. **Améliorer la synchro “retour au premier plan / reconnexion”**
   - À `window focus`, `visibilitychange`, `online`, forcer un `invalidateAll` léger pour recoller immédiatement à l’état serveur.

4. **Fiabiliser les mises à jour d’application (nouveau build)**
   - Remplacer l’enregistrement SW passif par un enregistrement contrôlé (`virtual:pwa-register`) avec prompt “Nouvelle version disponible”.
   - Bouton “Mettre à jour maintenant” => 1 seul refresh propre (pas de refresh manuel répété).

---

## 2) Refonte de la carte “stats comptes par période” en onglet dédié

1. **Créer un onglet dédié dans `AccountsPage`**
   - Passer à 3 onglets : `Gestion`, `Stats période`, `Récapitulatif`.
   - Retirer `AccountsPeriodStats` de l’onglet gestion et l’afficher uniquement dans ce nouvel onglet dédié.

2. **Refondre `AccountsPeriodStats`**
   - **Afficher tous les comptes** (même sans mouvement, valeurs à 0).
   - Ajouter des filtres avancés :
     - recherche compte améliorée (debounce),
     - multi-sélection comptes (avec reset clair),
     - tri (nom, net, revenu, dépense, écart).
   - Périodes améliorées :
     - aujourd’hui, semaine, mois, trimestre, semestre, année, tout, personnalisé.
   - Garder datepicker interactif en popover/dialog (`pointer-events-auto`).

3. **UX/UI améliorée**
   - barre de filtres claire (compacte desktop/mobile),
   - badges de filtres actifs,
   - état vide explicite,
   - lisibilité renforcée des indicateurs (revenus/dépenses/net/théorique).

---

## 3) Solde réel = uniquement saisi par l’utilisateur

1. **Supprimer toute mise à jour automatique du solde réel après transaction**
   - Enlever les appels `recalculate_account_balance` dans :
     - `TransactionsPage.tsx` (create/edit/delete/bulk)
     - `SavingsPage.tsx` (dépôt/retrait)
     - `CashCountDialog.tsx` (après PV espèces)
     - `process-recurring`
     - `import-journal`

2. **Adapter les fonctions backend**
   - Migration SQL :
     - `perform_transfer` : ne plus toucher `payment_accounts.real_balance`.
     - `recalculate_account_balance` : neutraliser (no-op) ou marquer fonction legacy sans effet.
   - Ainsi, même si un appel persiste, le solde réel ne bouge plus automatiquement.

3. **Conserver la saisie manuelle comme source unique du réel**
   - Le dialogue “Mettre à jour solde réel” reste l’action manuelle officielle.
   - Le PV espèces mettra à jour explicitement le `real_balance` saisi par l’utilisateur (pas via recalcul auto).

4. **Préserver la cohérence métier dans l’app**
   - Utiliser le **solde théorique calculé** (opening + transactions) pour les vues opérationnelles (cartes/global).
   - Garder `solde réel` et `écart` pour la réconciliation (module comptes).

---

### Fichiers principalement impactés
- `src/App.tsx` / `src/main.tsx` (gestion update SW + sync globale)
- `vite.config.ts` (enregistrement PWA contrôlé)
- `src/components/dashboard/DashboardLayout.tsx` (hook sync)
- `src/pages/dashboard/AccountsPage.tsx`
- `src/components/dashboard/accounts/AccountsPeriodStats.tsx`
- `src/pages/dashboard/TransactionsPage.tsx`
- `src/pages/dashboard/SavingsPage.tsx`
- `src/components/dashboard/CashCountDialog.tsx`
- `src/pages/dashboard/DashboardHome.tsx`
- `src/components/dashboard/home/AccountsWidget.tsx`
- `src/components/dashboard/home/AccountsSummaryWidget.tsx`
- `supabase/functions/process-recurring/index.ts`
- `supabase/functions/import-journal/index.ts`
- nouvelle migration SQL (fonctions + publication realtime)

---

### Validation prévue (E2E)
1. Créer/éditer/supprimer transactions :  
   - théorique change immédiatement,  
   - réel ne change pas automatiquement.
2. Mettre à jour solde réel manuellement : écart recalculé correctement.
3. Effectuer transfert et récurrents : aucun auto-update du réel.
4. Ouvrir l’onglet “Stats période” :
   - tous les comptes visibles,
   - recherche/filtre/tri/période OK.
5. Déployer une modif de test :
   - apparition du prompt de nouvelle version,
   - refresh unique,
   - app synchronisée immédiatement après reprise de focus/reconnexion.

---

### Détails techniques
- **Sécurité/RLS** : pas de relâchement des politiques; on ajoute uniquement publication realtime + refetch ciblé.
- **Compatibilité** : on garde les schémas métiers existants; changement principal = suppression des effets automatiques sur `real_balance`.
- **Performance** : invalidation ciblée + throttle sur événements realtime pour éviter surcharge de requêtes.
