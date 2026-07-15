---
name: savings-integrity-p1
description: RPC withdraw_from_goal + ledger savings_goal_transactions + trigger auto-complete + soft-delete pour savings_goals
type: feature
---
## P1 — Intégrité épargne (2026-07)

**RPC `withdraw_from_goal(p_goal_id, p_amount, p_destination_account_id, p_note)`**
SECURITY DEFINER. Contrôles côté serveur : ownership `auth.uid()`, `is_locked=false`, `deleted_at IS NULL`, `current_amount >= amount`, compte destination actif. Effectue : UPDATE `savings_goals.current_amount`, INSERT dans `transactions` (income), INSERT dans `savings_goal_transactions` (kind='withdrawal'). Codes d'erreur : `GOAL_LOCKED`, `INSUFFICIENT_BALANCE`, `GOAL_DELETED`, `DESTINATION_ACCOUNT_INVALID`, `INVALID_AMOUNT`, `GOAL_NOT_FOUND`. Utilisée par `PartialWithdrawDialog`.

**Ledger `savings_goal_transactions`** (goal_id, user_id, kind ∈ deposit/withdrawal/interest/adjustment/sync, amount ≥ 0, source_account_id, transaction_id, note, created_at). Audit-only pour l'instant : le trigger `trg_sync_savings_from_transaction` reste la source de vérité pour `current_amount`. Prochaine itération : supprimer la dérivation et lire directement depuis le ledger.

**Trigger `trg_auto_complete_savings_goal`** (BEFORE UPDATE OF current_amount, target_amount) : passe `status` de `active`→`completed` dès que `current_amount >= target_amount`. Réactive `completed`→`active` si un retrait fait retomber sous la cible (jamais si `paused_at` ou `deleted_at`).

**Soft-delete uniforme** : `handleDelete` dans `SavingsPage.tsx` ne fait plus `DELETE` mais `UPDATE deleted_at=now()` — cohérent avec les autres modules (transactions/budgets) et la corbeille 30 j.

**À faire (P2/P3)** : cron de capitalisation, solde initial, objectifs renouvelables, Zod dur, milestones, versements auto, Pause/Reprise dans l'UI.

## P2 — Métier (2026-07)

**Nouvelles colonnes `savings_goals`** : `opening_balance` (défaut 0), `is_renewable`, `renewal_frequency` ∈ {monthly,quarterly,semi_annual,yearly}, `last_renewed_at`, `renewal_count`.

À la création d'un objectif, `current_amount = opening_balance` (permet de repartir d'un solde déjà présent). Champ affiché uniquement en création (pas en édition).

**Cron `savings-maintenance-daily`** (02:15 UTC) enchaîne :
- `capitalize_savings_interest()` : crédite les intérêts composés au taux périodique = annuel / n_périodes, période échue depuis `last_capitalized_at`. Ledger `kind='interest'`.
- `renew_savings_goals()` : archive les objectifs `is_renewable=true` dont la deadline est atteinte ou déjà `completed`, puis clone un nouveau cycle avec `current_amount=0`, `opening_balance=0`, nouvelle `deadline = ancienne + renewal_frequency`, `renewal_count += 1`.

Les deux RPC sont SECURITY DEFINER, `EXECUTE` révoqué à PUBLIC, accordé à `service_role` (et pg_cron s'exécute en superuser).

**Zod durci** (`savingsGoalSchema`) : plafond 999 999 999, `interest_frequency` en enum, notes max 500 car., `superRefine` bloque deadline ≤ start_date et opening_balance > target_amount.