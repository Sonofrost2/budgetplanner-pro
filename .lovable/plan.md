

## Diagnostic actuel (mesuré sur la preview)

**Volume mesuré :** 15-31 notifs/jour pour le même utilisateur sur les 7 derniers jours. Cause :
1. **Doublon cron** : `daily-budget-alerts` (07h) ET `check-alerts-daily` (08h) appellent la même fonction → tout est envoyé 2× chaque matin.
2. **Dedup faible** : la `dedup_key` inclut `${todayStr}` → la même alerte de statut (budget contrôlé, épargne insuffisante, dépense à venir, projection) refire **chaque jour à l'identique**.
3. **Aucun plafond** par utilisateur : 12 types d'alertes peuvent toutes tomber le même matin.
4. **Pas de différenciation début/fin de période** : les rappels d'action et les bilans sont mélangés au même rythme.

## Refonte proposée

### 1. Nettoyage cron (immédiat)
- Supprimer le cron `check-alerts-daily` (08h, doublon).
- Garder `daily-budget-alerts` à 07h, **renommé en `morning-coach-digest`**.
- Ajouter un nouveau cron **`evening-capture-reminder`** à **20h** : rappel quotidien obligatoire de saisir les transactions du jour (incitation à l'usage).

### 2. Cadence intelligente par type d'alerte (table de fréquence)

| Type d'alerte | Phase | Fréquence par défaut |
|---|---|---|
| `budget_exceeded`, `debt_overdue`, `daily_budget_exceeded` | Critique | Immédiat, 1× / 24h |
| `budget_threshold` (80%), `budget_projection` | Action début/milieu période | 1× au franchissement, puis tous les 3 jours si ↑ |
| `budget_upcoming_expense`, `recurring_reminder`, `savings_contribution_upcoming` | Rappel d'action | J-5, J-2, J-0 (3 envois max) |
| `savings_no_contribution`, `savings_insufficient` | Rappel d'action | 1× / semaine (lundi) |
| `budget_controlled`, `budget_goal_reached`, `savings_goal_reached` | **Bilan fin de période** | 1× à la clôture (dernier jour de la période) |
| `balance_discrepancy` | Anomalie | 1× / 7 jours tant que non résolu |
| `daily_capture_reminder` (NOUVEAU) | Habitude | **1× / jour à 20h, obligatoire** |

**Mécanique** : `dedup_key` perd la date et gagne une fenêtre. Ex : `budget_threshold_${budget.id}_w${isoWeek}` (1×/semaine) ou `budget_threshold_${budget.id}_step${roundedPct/10}` (1× par palier de 10pts atteint).

### 3. Digest matinal unique
Toutes les alertes **non-critiques** générées par `morning-coach-digest` sont **agrégées en UNE seule notif push** :
> 🌅 Coach matinal — 2 budgets à surveiller, 1 cotisation jeudi, vous êtes en avance sur Voyage. *Voir détails →*

Le clic ouvre `/dashboard` avec le `NotificationBell` ouvert sur l'onglet "Aujourd'hui" listant les détails. Les alertes **critiques** (dépassement, dette en retard) restent en notif séparée.

### 4. Plafond utilisateur : max 3 push/jour + digest
Compteur dans `notification_history` : si déjà 3 envoyés ce jour (hors digest et critiques), les suivants sont absorbés dans un digest "+ X autres alertes".

### 5. Préférences utilisateur étendues
Ajouter à `notification_preferences` :
- `morning_digest_enabled` (bool, def true)
- `morning_digest_hour` (int 5-11, def 7)
- `evening_capture_enabled` (bool, def true) — **pas masquable côté Free, juste retardable**
- `evening_capture_hour` (int 17-22, def 20)
- `status_reminder_frequency` (enum: `weekly` | `every_3d` | `on_change_only`, def `weekly`)
- `max_push_per_day` (int 1-10, def 3)

UI : refonte du `NotificationPreferencesCard` avec nouvelle section **"Cadence & moments"** (sliders horaires + select cadence).

### 6. Nouveau : Daily Capture Reminder (20h)
Nouvelle edge function `daily-capture-reminder` :
- Pour chaque user avec push actif, vérifier s'il a saisi ≥1 transaction aujourd'hui.
- Sinon → notif coach : *"📝 Quoi de neuf aujourd'hui ? Saisis tes transactions du jour en 30 secondes pour garder ton coach affûté."* (lien `/dashboard/transactions?quickAdd=1`)
- Si déjà actif → notif positive 1×/semaine seulement : *"🔥 7 jours de saisie d'affilée — bravo !"* (streak).
- Respecte quiet_hours et `evening_capture_enabled`.

### 7. Bilan de fin de période (sans nouveau cron)
Dans `morning-coach-digest`, détecter `now == periodEnd` pour chaque budget/épargne et générer une notif **synthèse** dédiée :
> 🏁 Bilan Avril — Courses : -8% vs budget, Épargne Voyage : +45 000 (objectif 90%). *Voir le rapport →*

## Fichiers touchés (estimation)

- `supabase/functions/check-alerts/index.ts` — refactor majeur : nouvelles fenêtres dedup, agrégation digest, plafond, branchement cadence
- `supabase/functions/daily-capture-reminder/index.ts` — **nouveau**
- Migration SQL : colonnes `notification_preferences` + suppression cron 08h + ajout cron 20h + renommage cron 07h
- `src/hooks/useNotificationPreferences.tsx` — nouveaux champs typés
- `src/components/dashboard/settings/NotificationPreferencesCard.tsx` — nouvelle section "Cadence & moments"
- `src/components/dashboard/NotificationBell.tsx` — onglet "Aujourd'hui" pour déplier le digest
- Bug runtime mineur (`Cannot create property '_interval' on number '716'`) — fix opportuniste dans `usePushNotifications` ou setTimeout mal typé

## Résultat attendu

- **Volume** : 15-31/jour → **3-5/jour max**, dont ~1 digest matinal + 1 rappel saisie + alertes critiques ponctuelles.
- **Pertinence** : chaque notif a un cycle (début / milieu / fin de période), plus de répétition à l'identique.
- **Engagement** : rappel quotidien de saisie pour ancrer l'habitude, sans noyer l'utilisateur.
- **Contrôle** : utilisateur règle horaires, cadence et plafond depuis Réglages.

