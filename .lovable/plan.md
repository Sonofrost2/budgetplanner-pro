

## Plan : Refonte du preparateur hebdomadaire multi-periodicite + desactivation du module Charges recurrentes

### 1. Desactiver le module Charges recurrentes

Le module `RecurringPage` est un CRUD complet (484 lignes) pour gerer les charges recurrentes. L'utilisateur veut le desactiver/masquer car c'est redondant — les charges recurrentes devraient etre gerees via les budgets et categories.

**Fichiers a modifier :**

| Fichier | Action |
|---------|--------|
| `src/components/dashboard/DashboardLayout.tsx` | Retirer l'entree `recurring` du menu sidebar (ligne ~142) |
| `src/App.tsx` | Retirer la route `/dashboard/recurring` et l'import de `RecurringPage` |

> La table `recurring_transactions` et la edge function `process-recurring` restent en base (pas de suppression de donnees). On masque juste l'acces UI.

---

### 2. Refonte du WeeklyPlannerWidget — logique multi-periodicite

**Probleme actuel** : Le widget ne traite que les budgets `monthly` (ligne 89 : `b.period === 'monthly'`). Il ignore `daily`, `weekly`, `quarterly`, `semi_annual`, `yearly`.

**Nouvelle logique d'allocation par budget :**

Pour chaque budget, calculer la **cible hebdomadaire** en fonction de sa periodicite :

```text
Budget period    | Cible hebdomadaire          | Plage de calcul du "depense"
-----------------|-----------------------------|-----------------------------
daily            | amount × 7                  | 7 jours de la semaine
weekly           | amount (direct)             | semaine affichee
monthly          | remaining_month / weeks_left| mois en cours
quarterly        | remaining_qtr / weeks_left  | trimestre en cours
semi_annual      | remaining_sem / weeks_left  | semestre en cours
yearly           | remaining_year / weeks_left | annee en cours
```

Ou `remaining = budget.amount - depenses_deja_realisees_dans_la_periode`.

**Fonctions utilitaires a creer :**
- `getPeriodRange(period, refDate)` → `{start, end}` de la periode englobante (mois, trimestre, semestre, annee)
- `weeksRemainingInPeriod(period, refDate)` → nombre de semaines restantes dans la periode
- `computeWeeklyTarget(budget, periodSpent)` → cible hebdomadaire

**Donnees necessaires** : Pour calculer le "depense dans la periode", il faut les transactions de la periode entiere (pas juste le mois). Modification de `DashboardHome.tsx` pour charger les transactions depuis le debut de l'annee (couvrant toutes les periodicites).

---

### 3. Refonte du widget — revenus inclus

Actuellement le widget ne montre que les depenses. Il faut aussi afficher les budgets de type `income` pour montrer un **solde net hebdomadaire prevu**.

- Section "Depenses prevues" (budgets expense)
- Section "Revenus prevus" (budgets income)  
- Barre de solde net = revenus prevus - depenses prevues vs realise

---

### 4. Fichiers a modifier

| # | Fichier | Action |
|---|---------|--------|
| 1 | `DashboardLayout.tsx` | Masquer lien "Charges recurrentes" du sidebar |
| 2 | `App.tsx` | Retirer route et import RecurringPage |
| 3 | `WeeklyPlannerWidget.tsx` | Refonte complete : multi-periodicite, revenus, nouvelles fonctions utilitaires |
| 4 | `DashboardHome.tsx` | Charger transactions depuis debut d'annee pour le planner ; retirer `plannerTransactions` actuel |
| 5 | `dashTranslations.ts` | Nouvelles cles (revenus prevus, solde net hebdo, periodicites) |

### 5. Structure du widget refait

```text
┌─────────────────────────────────────┐
│ 📅 Preparateur Hebdomadaire         │
│ ◀ 10 mar — 16 mar ▶                │
├─────────────────────────────────────┤
│ Depenses         Cible    Real  +/- │
│ 🍔 Nourriture    15 000   12 000 +3k│
│ ⛽ Carburant     10 000    8 500 +1k│
│ 💳 Abonnements       0        0  —  │  ← mensuel, pas cette semaine
│ ...                                  │
├─────────────────────────────────────┤
│ Revenus          Prevu    Real  +/- │
│ 💰 Salaire            0       0  —  │  ← mensuel, pas cette semaine
├─────────────────────────────────────┤
│ 🟢 Economies: +4 500               │
│ [Reinvestir] [Garder]               │
└─────────────────────────────────────┘
```

Pour un budget **mensuel** de 60 000 en "Nourriture" :
- Si on est a la 2e semaine et qu'on a depense 25 000 le mois, il reste 35 000 pour ~2 semaines → cible = 17 500/semaine.

Pour un budget **hebdomadaire** de 10 000 en "Carburant" :
- Cible = 10 000 directement chaque semaine.

Pour un budget **mensuel** d'"Abonnements" de 30 000 (paye en fin de mois) :
- Si la semaine affichee n'est pas la derniere du mois, la cible est repartie proportionnellement. L'utilisateur peut personnaliser la cible a 0 pour cette semaine s'il sait que c'est en fin de mois.

