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
