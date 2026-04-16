
Plan approuvé : démarrer la **Phase E — Sécurité des données** (priorité maximale, ROI immédiat).

Actions Phase E :
1. **TX-1 Corbeille** : ajouter `deleted_at timestamptz` sur `transactions`, `budgets`, `debts`, `savings_goals`, `payment_accounts`, `categories`, `recurring_transactions`. Index partiels pour performance.
2. **TX-2/TX-3 Transferts synchronisés** : RPC `update_transfer` et `cancel_transfer`.
3. **TX-4 Détection doublons** : helper côté client (query + dialog warning).
4. **GL-3 Export JSON** : edge function `export-user-data`.

Je commence par la migration DB (fondations), puis enchaîne avec le code.
