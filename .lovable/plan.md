

# Audit complet de Budget Planner

## 1. Architecture & Code Quality

### Fichiers trop volumineux (dette technique)
Les pages principales dépassent largement les 500 lignes, rendant la maintenance difficile :
- `SavingsPage.tsx` : **1021 lignes** — logique métier, formulaires, simulation IA, PDF export, tout dans un seul fichier
- `TransactionsPage.tsx` : **824 lignes**
- `BudgetsPage.tsx` : **755 lignes**
- `AccountsPage.tsx` : **744 lignes**
- `RecurringPage.tsx` : **574 lignes**

**Recommandation** : Extraire les handlers (CRUD, AI, export) dans des hooks custom dédiés (`useSavingsActions`, `useTransactionActions`, etc.) et les formulaires en composants séparés.

### Patterns incohérents
- **Fetching data** : `SettingsPage` et `DashboardLayout` utilisent `useEffect` + `supabase.from()` directement, tandis que le reste utilise TanStack Query. Il faut migrer `SettingsPage` et `DashboardLayout` vers React Query pour la cohérence et le cache.
- **Type casting** : Nombreux `as any` dans `SavingsPage` (ex: `(goal as any).interest_rate`, `(goal as any).is_locked`). Les types Supabase ne sont pas synchronisés avec les colonnes réelles.
- **Validation** : `TransactionsPage` utilise de la validation manuelle inline, tandis que la mémoire projet prescrit Zod + React Hook Form. Aucune page n'utilise réellement Zod.

---

## 2. Sécurité

### Points positifs
- RLS activé sur toutes les tables avec des politiques correctes
- `notification_history` protégé contre les écritures client
- `user_roles` verrouillé (INSERT/UPDATE/DELETE refusés côté client)
- Trigger `handle_new_user` + `create_default_categories` en `SECURITY DEFINER`
- Confirmation email requise (pas d'auto-confirm)

### Problèmes identifiés
- **Pas de Google OAuth** : La mémoire projet et les bonnes pratiques demandent d'ajouter Google Auth pour les inscriptions/connexions.
- **Pas de validation Zod côté client** : Les formulaires de login/signup n'ont qu'une validation basique (`password.length < 8`). Pas de protection contre les injections dans les descriptions de transactions.
- **`notify_on_transaction_insert` contient la clé anon en dur** : Le trigger SQL embarque la clé anon Supabase dans le code source. Ce n'est pas critique (clé publique) mais c'est une mauvaise pratique.
- **SettingsPage : incohérence mot de passe** : Le dialog dit "min. 6 caractères" mais la validation vérifie `< 8`. Le formulaire Signup utilise `minLength={6}` en HTML mais vérifie `< 8` en JS.
- **`delete-account` edge function** : Ne liste pas les tables `assets`, `asset_valuations`, `notification_history`, `notification_preferences` dans le nettoyage. Des données orphelines resteront après suppression.

---

## 3. UX / Interface

### Améliorations recommandées
- **Pas de Google Sign-In** : Ajouter le bouton Google sur les pages Login et Signup pour réduire la friction d'inscription.
- **Loading states** : Les boutons montrent juste `...` pendant le chargement — utiliser un spinner `Loader2` avec le texte pour un meilleur feedback.
- **État vide (empty states)** : Plusieurs pages n'ont pas d'état vide illustré (transactions, budgets). Ajouter des illustrations + CTA.
- **Accessibilité** : Aucun `aria-label` sur les boutons icônes (search, notification bell). Les contrastes du glassmorphism peuvent être insuffisants.
- **Mobile** : La sidebar est cachée sur mobile avec `hidden lg:block` et remplacée par `MobileBottomNav`, mais la barre de recherche ⌘K n'est pas facilement accessible sur mobile (petit bouton).
- **Dashboard trop dense** : 8 widgets affichés simultanément. Considérer un mode "compact" par défaut avec expansion à la demande.

---

## 4. Performance

### Points positifs
- Pagination server-side pour les transactions
- `manualChunks` dans Vite pour le code splitting
- `staleTime` configuré sur les requêtes React Query
- PWA avec Workbox et pré-cache

### Améliorations
- **Lazy loading des pages** : Toutes les pages dashboard sont importées statiquement dans `App.tsx`. Utiliser `React.lazy()` + `Suspense` pour les charger à la demande (réduction du bundle initial d'environ 30-40%).
- **SavingsPage charge tout en une requête** : `useSavingsPageData` récupère tous les objectifs + toutes les transactions associées. Pour les utilisateurs avec beaucoup de données, cela peut être lent.
- **Images/avatars** : Pas de gestion d'images optimisée. Les avatars pourraient utiliser un CDN/resize.

---

## 5. Fonctionnalités manquantes ou incomplètes

| Fonctionnalité | État | Priorité |
|---|---|---|
| Rappels de cotisation épargne (contribution_day) | Pas implémenté dans `check-alerts` | Haute |
| Notification objectif atteint (100%) | Pas de trigger/check automatique | Haute |
| Google OAuth | Absent | Haute |
| Import CSV/bancaire de transactions | Absent | Moyenne |
| Historique des notifications (page UI) | Table existe, pas de page | Moyenne |
| Multi-devise (conversion) | Devise unique par profil | Basse |
| Recherche full-text | Recherche `ilike` basique | Basse |
| Mode sombre/clair automatique selon OS | `useTheme` existe mais pas testé | Basse |

---

## 6. Edge Functions

### Problèmes
- **Imports `esm.sh`** : Toutes les edge functions importent depuis `esm.sh` sans version pinned pour certaines dépendances. Risque de breaking changes.
- **CORS headers** : Les headers CORS sont définis manuellement dans chaque function. Devrait utiliser l'import depuis `@supabase/supabase-js/cors` (v2.95+).
- **`delete-account`** : Tables manquantes dans la liste de nettoyage (voir section sécurité).
- **Pas de validation d'entrée** : La plupart des edge functions ne valident pas les inputs avec Zod.

---

## 7. Plan d'action recommandé (par priorité)

### Phase 1 — Corrections critiques
1. **Ajouter Google OAuth** (Login + Signup)
2. **Corriger `delete-account`** : ajouter les tables manquantes (`assets`, `asset_valuations`, `notification_history`, `notification_preferences`)
3. **Lazy loading** des pages dashboard dans `App.tsx`
4. **Implémenter les rappels de cotisation** dans `check-alerts`

### Phase 2 — Qualité & cohérence
5. **Migrer SettingsPage** vers React Query
6. **Extraire les hooks d'actions** des pages volumineuses (SavingsPage, TransactionsPage)
7. **Fixer les types** : supprimer les `as any` dans SavingsPage en synchronisant les types
8. **Uniformiser les loading states** (spinner au lieu de `...`)
9. **Corriger l'incohérence mot de passe** (8 caractères partout)

### Phase 3 — Fonctionnalités
10. **Page historique notifications**
11. **Import CSV de transactions**
12. **Notification automatique objectif atteint**
13. **Empty states** illustrés sur toutes les pages

---

## Résumé technique

```text
┌────────────────────────────────────────┐
│          Score d'audit global          │
├────────────────┬───────────────────────┤
│ Sécurité       │ ████████░░  8/10      │
│ Performance    │ ███████░░░  7/10      │
│ Code Quality   │ ██████░░░░  6/10      │
│ UX/UI          │ ████████░░  8/10      │
│ Fonctionnalités│ ███████░░░  7/10      │
│ Tests          │ █░░░░░░░░░  1/10      │
├────────────────┼───────────────────────┤
│ GLOBAL         │ ██████░░░░  6.2/10    │
└────────────────┴───────────────────────┘
```

L'application est fonctionnellement riche et bien conçue visuellement, mais souffre de dette technique (fichiers monolithiques, types inconsistants, absence de tests) et de quelques lacunes de sécurité mineures. Les corrections de la Phase 1 sont réalisables rapidement et apporteraient le plus de valeur.

