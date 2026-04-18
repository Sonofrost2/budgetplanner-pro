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
