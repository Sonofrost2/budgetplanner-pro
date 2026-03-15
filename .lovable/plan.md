

## Plan de correction des notifications (sans dettes)

### 1. Enregistrer les Edge Functions manquantes dans `config.toml`

Ajouter `check-alerts`, `push-notify`, `import-journal`, `subscription-renew` dans `supabase/config.toml` avec `verify_jwt = false`.

### 2. Créer les cron jobs via SQL insert (pas migration)

Utiliser `pg_cron` + `pg_net` pour planifier :
- `check-alerts` tous les jours à 7h UTC
- `process-recurring` tous les jours à 6h UTC

SQL exécuté via l'outil insert (contient des données spécifiques au projet : URL + anon key).

### 3. Améliorer `NotificationBell.tsx`

- Ajouter un rafraîchissement automatique toutes les 5 minutes via `setInterval`
- Aligner la logique avec `check-alerts` : inclure aussi les transactions importées (`type='income'`, description contenant "cotisation epargne")
- Aucune alerte de dettes (module désactivé)

### 4. Retirer la route `/dashboard/debts` de `App.tsx`

Supprimer la ligne 75 (`<Route path="debts" ...>`) et l'import `DebtsPage` (ligne 37) pour cohérence avec la désactivation du module.

### Fichiers impactés

| Fichier | Action |
|---------|--------|
| `supabase/config.toml` | Ajouter 4 fonctions |
| `src/components/dashboard/NotificationBell.tsx` | Rafraîchissement auto + contributions importées |
| `src/App.tsx` | Retirer route et import debts |
| SQL insert (pas migration) | Cron jobs `check-alerts` + `process-recurring` |

