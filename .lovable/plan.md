

# Bell notifications — alignement sur les dates prévisionnelles

## Problème constaté

Le hook `useBudgetNotifications` (qui alimente la cloche 🔔 dans le header) :

1. N'utilise **pas** `computeDaysRemaining` ni `expected_day` / `occurrence_frequency` / `reference_date` → les rappels d'échéance ne tombent jamais aux bons jours.
2. N'a **aucune notion de J-5 / J-2 / J-0** (la logique côté edge function existe déjà, mais le bell affiche tout dans une fenêtre fixe de 7 jours).
3. N'exclut **pas** les budgets / objectifs `paused_at` ou `deleted_at` → notifications fantômes.
4. Inclut les **transferts internes** (`linked_transfer_id`) dans les sommes de budgets et contributions épargne → calculs faussés.
5. Ne respecte **pas la cadence utilisateur** (`status_reminder_frequency`, `morning_digest_hour`, `quiet_hours_*`) déjà stockée dans `notification_preferences`.
6. Pour l'épargne : `contribution_day` est comparé au jour du mois courant uniquement → si on est le 28 et la cotisation tombe le 5, `daysUntil = 0` au lieu de "dans 8 jours".
7. Les alertes "écart de solde" ne tiennent pas compte des `archived_at` sur les comptes.

## Refonte proposée

### A. Refactor `useBudgetNotifications` (`NotificationBell.tsx`)

**Filtrage en amont des entités** :
- `budgets`: ajouter `.is('deleted_at', null).is('paused_at', null)`
- `savings_goals`: ajouter `.is('deleted_at', null).is('paused_at', null).eq('status','active')`
- `payment_accounts`: ajouter `.is('archived_at', null).is('deleted_at', null)`
- `transactions`: ajouter `.is('deleted_at', null).is('linked_transfer_id', null)` partout

**Calcul des sommes budgets** : exclure aussi les tx avec `notes LIKE '🎯%'` côté revenus si le budget est de type income (évite double comptage avec contributions épargne).

**Échéances de budget** :
- Importer `computeDaysRemaining` depuis `@/lib/budgetProjection` (déjà existant, sous-utilisé).
- Pour chaque budget avec `expected_day` ou `occurrence_frequency` : calculer `daysLeft` via ce helper.
- N'émettre `budget_upcoming` qu'aux **paliers J-5, J-2, J-0** (cohérent avec edge function), plus le label `today`/`thisWeek`/`passed` retourné par le helper.
- Ajouter une notif **"Période clôturée aujourd'hui"** quand `todayStr === periodEndStr` avec le bilan (atteint / dépassé / maîtrisé).

**Échéances d'épargne** :
- Si `contribution_day` est passé ce mois → calculer la distance jusqu'au **mois suivant** (même logique que `computeDaysRemaining` "monthly").
- N'afficher qu'aux paliers J-5 / J-2 / J-0.
- Pour `deadline` : ajouter un palier J-30 / J-7 / J-0.
- Si l'objectif est `is_locked` et `deadline` future → ne **pas** alerter "versement insuffisant".

**Échéances récurrentes** :
- Garder la fenêtre 7 jours mais émettre les alertes uniquement aux J-5 / J-2 / J-0 (cohérent edge function), pas tous les jours.
- Exclure les `recurring_transactions` dont `end_date < today`.

**Cadence utilisateur** :
- Lire `notification_preferences` (1 query supplémentaire).
- Si `quiet_hours_enabled` et heure courante dans la fenêtre → renvoyer `[]` (la cloche restera vide jusqu'à la fin du quiet).
- Si `status_reminder_frequency = 'on_change_only'` → masquer `budget_warning` / `savings_behind` qui n'ont pas changé de palier 10pts depuis la dernière visite (palier mémorisé en `localStorage`).
- Si une préférence type est `false` (ex. `budget_alerts: false`) → retirer les notifs correspondantes.

**Écarts de solde** :
- Ne plus inclure les comptes `archived_at IS NOT NULL`.
- Calcul théorique : exclure transferts internes des deux côtés (sinon faux écart).

### B. Centraliser la logique de cadence

Créer `src/lib/notificationCadence.ts` (nouveau fichier) :
- `shouldFireUpcoming(daysUntil: number): boolean` → true si 0/2/5
- `shouldFireBilan(periodEnd: Date, now: Date): boolean` → true si même jour
- `inQuietHours(now: Date, prefs): boolean`
- `getStepBucket(pct: number): number` → palier 10pts
- `hasStepChanged(key: string, currentBucket: number): boolean` (lit/écrit localStorage)

Réutilisé par `NotificationBell` aujourd'hui, et potentiellement par toast Coach plus tard.

### C. UI cloche : nouveaux libellés et tri

- Ajouter dans `NotificationBell.tsx` un libellé dynamique sous chaque notif : "dans 5 jours", "aujourd'hui", "période clôturée" (basé sur le `daysLeft` retourné par `computeDaysRemaining`).
- Réordonner : critiques > échéance aujourd'hui > échéance < 3j > seuils > bilans > succès.
- Ajouter un onglet **"À venir"** (séparé de "Aujourd'hui") qui regroupe les J-5/J-2 → l'utilisateur voit clairement ce qui arrive vs ce qui se passe maintenant.

### D. Tests manuels post-déploiement

- Créer un budget mensuel avec `expected_day = 25`, vérifier qu'aucune alerte upcoming n'apparaît avant le 20, puis le 20 (J-5), 23 (J-2), 25 (J-0).
- Créer un objectif épargne avec `contribution_day = 5`, le tester un 28 → doit afficher "dans 8j" puis monter en alerte le 30/3/5.
- Mettre un budget en pause → vérifier qu'il disparaît de la cloche.
- Faire un transfert interne → vérifier qu'il n'apparaît pas dans le calcul du budget catégorie.

## Fichiers touchés

| Fichier | Type de change |
|---|---|
| `src/components/dashboard/NotificationBell.tsx` | Refactor majeur du hook + UI tri/libellés |
| `src/lib/notificationCadence.ts` | **Nouveau** — helpers de cadence partagés |
| `src/lib/budgetProjection.ts` | Aucun (déjà bon, juste ré-utilisé) |

Aucune migration SQL, aucune edge function touchée — la refonte est 100 % côté client puisque le bug est dans le hook front.

## Résultat attendu

- Cloche n'affiche que des alertes **temporellement pertinentes** (basées sur `expected_day`, `contribution_day`, `next_date`, `deadline`, `periodEnd`).
- Plus de notifs sur budgets/objectifs en pause ou supprimés.
- Plus de comptage de transferts internes dans les budgets.
- Cadence respectée : quiet hours, fréquence de rappels de statut, plafond, types désactivés.
- Onglet "À venir" pour visualiser l'horizon J-5 sans pollution du présent.

