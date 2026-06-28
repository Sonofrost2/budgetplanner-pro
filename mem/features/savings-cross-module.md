---
name: savings-cross-module
description: savingsLogic helper + SQL trigger sync_savings_from_transaction propage transactions vers savings_goals.current_amount via budgets liés
type: feature
---
## Synchronisation transactions ↔ savings_goals

**Trigger DB** `trg_sync_savings_from_transaction` sur `transactions` (AFTER INSERT/UPDATE/DELETE) :
- Si `transactions.category_id` correspond à `budgets.category_id` d'un budget avec `linked_savings_goal_id` non nul, alors :
  - `expense` → `current_amount += amount`
  - `income`  → `current_amount -= amount` (retrait)
  - `transfer` → ignoré
- Gère INSERT (apply NEW), DELETE (revert OLD), UPDATE (revert OLD + apply NEW).
- Fonction `sync_savings_from_transaction()` est SECURITY DEFINER, search_path=public.
- `current_amount` est borné à `GREATEST(0, ...)` (jamais négatif).

**Source de vérité** : transactions catégorisées. Le bouton "Ajouter au coffre" reste utile pour créer la paire de transactions atomique via `perform_transfer` avec catégorie forcée.

**Logique frontend (savingsLogic.ts)** : isLiveGoal/isReachedGoal/isTerminalGoal/isLiveAccount + liveSavingsTotal/liveSavingsTarget/justReachedCount/partitionGoals. Totaux excluent completed/paused/archived/deleted partout (Dashboard, Wealth, Health, AI Coach, Forecast).

**Réconciliation** : si on suspecte une dérive, relancer le UPDATE de réconciliation (voir migration 20260429).
---
name: Savings cross-module harmonization
description: savingsLogic helper + SQL trigger auto-archiving linked accounts + filters in Wealth/Health/AIChat/Dashboard widgets
type: feature
---
**Règle unique** : seuls les objectifs `status='active' AND paused_at IS NULL AND deleted_at IS NULL` comptent dans les totaux d'épargne **partout** (Dashboard, Patrimoine, AI Coach, Health Score, KPI hero épargne). Les comptes archivés (`archived_at IS NOT NULL`) sont exclus partout aussi.

**Source de vérité** : `src/lib/savingsLogic.ts` expose `isLiveGoal`, `isLiveAccount`, `isReachedGoal`, `isTerminalGoal`, `liveSavingsTotal`, `liveSavingsTarget`, `partitionGoals`. Toute nouvelle feature qui somme/affiche des objectifs DOIT passer par ces helpers.

**SQL** :
- `compute_health_score` filtre `status='active' AND paused_at IS NULL` pour `savings_total`, et `archived_at IS NULL AND status='active'` pour la diversification.
- Trigger `check_savings_completion` (BEFORE UPDATE on `savings_goals`) : quand un objectif passe à `completed` ou `archived`, le `payment_account` lié est auto-archivé (`archived_at = now()`, `status='archived'`).
- Index partiels `idx_savings_goals_active` et `idx_payment_accounts_active` accélèrent les filtres.

**Composants migrés** :
- `WealthWidget`, `WealthPage` (`savings-goals-wealth-live` query) — ne somment plus que les goals actifs.
- `SavingsWidget` (dashboard home) — filtre via `isLiveGoal` avant tout calcul.
- `AIChatWidget` — filtre comptes ET goals avant injection dans le prompt context.
- `SavingsHeroHeader` — KPI principal = somme live; `completedCount` reste affiché pour info.
- `SavingsPage.filteredGoals` respecte le toggle `showCompleted` (caché par défaut).

**À venir (deferred)** : `GoalReachedDialog` à 4 options (Réinvestir / Transférer / Convertir en actif patrimoine / Archiver simple) déclenché à la transition `active → completed`. Pour l'instant le trigger SQL fait juste l'auto-archivage du compte, l'utilisateur garde la main sur la suite (transfert manuel, asset manuel).
