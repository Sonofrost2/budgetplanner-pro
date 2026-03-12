

# Plan complet d'ameliorations — Budget Planner Pro

Base sur l'analyse du fichier Excel "Budget Planner Vdef" et les besoins identifies.

---

## LOT 1 — Priorite haute (pas de migration DB sauf budgets)

### 1.1 Tableau recapitulatif global des objectifs d'epargne
- **Nouveau fichier** : `src/components/dashboard/savings/SavingsSummaryTable.tsx`
- Tableau avec colonnes : Icone | Nom | Barre de progression | Montant/Cible | % | Statut | Mensualite requise
- Statuts : **Atteint** (vert, current >= target), **En retard** (rouge, deadline passee), **En cours** (bleu)
- Ligne de totaux en bas avec aggregation globale
- Composants existants : `Table`, `Progress`, `Badge`
- **Modification** : `SavingsPage.tsx` — import et rendu au-dessus de la grille de cards

### 1.2 Rappels automatiques mensuels pour versements d'epargne en retard
- **Modification** : `NotificationBell.tsx`
  - Nouveau type `'savings_behind'` avec icone `PiggyBank`
  - Fetch transactions epargne du mois (`notes LIKE '🎯 %'`)
  - Pour chaque objectif non atteint avec deadline : calcul `monthlyNeeded = remaining / monthsLeft`
  - Notification si aucun versement ce mois ou si versement < 90% du necessaire

### 1.3 Rapport Cash Flow mensuel
- **Nouveau composant** : `CashFlowReport.tsx` rendu dans un 3e onglet de `ReportsPage.tsx`
- Tableau annuel : Report | Revenus | Depenses | Tresorerie nette | Solde fin de mois
- Calcul du report (solde fin mois precedent = debut mois suivant)
- Selecteur d'annee
- Pas de changement DB, calcul client-side depuis transactions existantes

### 1.4 Rapport Budget vs Reel
- **Nouveau composant** : `BudgetVsActualReport.tsx` rendu dans un 4e onglet de `ReportsPage.tsx`
- Tableau : Categorie | Budget alloue | Depense reelle | Ecart | % Consommation
- Code couleur : vert (<80%), orange (80-100%), rouge (>100%)
- Pas de changement DB

### 1.5 Edition de budgets + Seuil d'alerte 80%
- **Migration DB** : `ALTER TABLE budgets ADD COLUMN alert_threshold integer DEFAULT 80`
- **Modification** : `BudgetsPage.tsx`
  - Refactoring du dialog pour supporter edition (pre-remplir le formulaire, update au lieu d'insert)
  - Bouton edit sur chaque card de budget
  - Toast d'alerte quand un budget atteint le seuil configurable

### 1.6 Dashboard KPIs enrichis
- **Modification** : `StatsCards.tsx` — passer de 3 a 5 cards
  - **Taux d'epargne** : `(revenus - depenses) / revenus * 100` avec icone `Percent`
  - **Tresorerie nette** : revenus - depenses du mois avec icone `Calculator`
- Nouvelles props `savingsRate` et `netCashFlow` passees depuis `DashboardHome.tsx`

### 1.7 Synthese par moyen de paiement (widget dashboard)
- **Nouveau composant** : `AccountsSummaryWidget.tsx`
- Regroupement des comptes par type (bank, mobile_money, cash, wallet) avec sous-totaux
- Affiche dans `DashboardHome.tsx` sous les StatsCards
- Pas de changement DB

---

## LOT 2 — Priorite moyenne (migrations DB)

### 2.1 Suivi des dettes
- **Migration DB** :
```sql
CREATE TABLE debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  creditor_name text NOT NULL,
  total_amount numeric NOT NULL,
  paid_amount numeric DEFAULT 0,
  due_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own debts" ON debts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```
- **Nouvelle page** : `src/pages/dashboard/DebtsPage.tsx` — CRUD avec cards de progression (paid/total)
- **Route** : `/dashboard/debts` dans `App.tsx`
- **Sidebar** : ajout dans `DashboardLayout.tsx` avec icone `Landmark`

### 2.2 Charges fixes / Transactions recurrentes
- **Migration DB** :
```sql
CREATE TABLE recurring_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  type text DEFAULT 'expense',
  category_id uuid REFERENCES categories(id),
  account_id uuid REFERENCES payment_accounts(id),
  frequency text DEFAULT 'monthly',
  next_date date NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recurring" ON recurring_transactions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```
- **Nouvelle page** : `src/pages/dashboard/RecurringPage.tsx`
- Integration du calcul "reste a vivre" dans le dashboard : revenus - charges fixes - epargne programmee

### 2.3 Controle d'epargne (cotisation prevue vs reelle)
- **Nouveau composant** dans `SavingsPage.tsx`
- Tableau : Objectif | Cotisation mensuelle prevue | Verse ce mois | Cumul | Ecart
- Calcul base sur `target_amount / mois entre creation et deadline` vs transactions reelles

---

## LOT 3 — Priorite basse

### 3.1 PV d'Especes (Cash Count)
- **Migration DB** :
```sql
CREATE TABLE cash_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES payment_accounts(id),
  counted_at timestamptz DEFAULT now(),
  denominations jsonb NOT NULL DEFAULT '{}',
  total_counted numeric DEFAULT 0,
  expected_balance numeric DEFAULT 0,
  discrepancy numeric DEFAULT 0,
  notes text
);
ALTER TABLE cash_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cash counts" ON cash_counts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```
- **Nouvelle page** : `/dashboard/cash-count` avec grille de saisie par denomination (configuree selon devise)
- Comparaison avec solde du compte cash, historique des comptages

### 3.2 Journal quotidien
- **Nouveau onglet** dans `ReportsPage.tsx`
- Tableau : Date | Revenus | Depenses | Net | Cumul revenus | Cumul depenses | Solde progressif
- Filtres par periode, pas de changement DB

---

## Traductions (i18n)

**~30 nouvelles cles** dans `dashTranslations.ts` (fr + en) couvrant :
- Epargne : `savingsSummary`, `savingsStatus`, `savingsLate`, `savingsInProgress`, `savingsCompleted`, `savingsTotal`, `savingsMonthlyNeeded`, `savingsReminder`, `savingsReminderBehind`, `savingsNoContribThisMonth`
- Rapports : `cashFlow`, `budgetVsActual`, `startingBalance`, `endingBalance`, `variance`, `consumptionPct`
- Budgets : `editBudget`, `alertThreshold`
- Dashboard : `savingsRate`, `netCashFlow`, `dailyBudget`, `accountsSummary`
- Dettes : `debts`, `addDebt`, `creditor`, `totalDebt`, `paidAmount`, `remainingDebt`
- Recurrences : `recurring`, `addRecurring`, `frequency`, `nextDate`, `fixedCharges`
- Cash Count : `cashCount`, `denomination`, `counted`, `expected`, `discrepancy`

---

## Resume des fichiers

| Lot | Fichier | Action | Migration |
|-----|---------|--------|-----------|
| 1 | `savings/SavingsSummaryTable.tsx` | Creer | Non |
| 1 | `SavingsPage.tsx` | Modifier | Non |
| 1 | `NotificationBell.tsx` | Modifier | Non |
| 1 | `CashFlowReport.tsx` | Creer | Non |
| 1 | `BudgetVsActualReport.tsx` | Creer | Non |
| 1 | `ReportsPage.tsx` | Modifier (2 onglets) | Non |
| 1 | `BudgetsPage.tsx` | Modifier (edit + seuil) | Oui (`alert_threshold`) |
| 1 | `StatsCards.tsx` | Modifier (5 cards) | Non |
| 1 | `DashboardHome.tsx` | Modifier (props) | Non |
| 1 | `AccountsSummaryWidget.tsx` | Creer | Non |
| 1 | `dashTranslations.ts` | Modifier | Non |
| 2 | `DebtsPage.tsx` | Creer | Oui (`debts`) |
| 2 | `RecurringPage.tsx` | Creer | Oui (`recurring_transactions`) |
| 2 | `App.tsx` | Modifier (routes) | Non |
| 2 | `DashboardLayout.tsx` | Modifier (sidebar) | Non |
| 3 | `CashCountPage.tsx` | Creer | Oui (`cash_counts`) |

