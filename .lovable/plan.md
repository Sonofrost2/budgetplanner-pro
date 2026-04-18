
The user wants to display the monthly total of "Régularisation" (adjustment) transactions in the HealthScoreWidget as a data-entry reliability indicator.

Current state of HealthScoreWidget: shows score /100 + savings rate + debt ratio. Data comes from `compute_health_score` RPC.

Approach: keep it simple — add a client-side query in HealthScoreWidget that fetches current-month transactions linked to categories whose name contains "régularisation" or "adjustment", sums them, and shows a 3rd compact stat row.

No DB migration needed (categories are user-created and identifiable by name, just like the Transactions filter we just built).

## Plan

**1. Extend `src/lib/healthScore.ts`**
- Add helper `fetchMonthlyRegularizationTotal(userId)`:
  - Query `categories` where name ILIKE '%régularisation%' OR ILIKE '%regularisation%' OR ILIKE '%adjustment%' for that user → get IDs
  - Query `transactions` filtered by those category IDs, current month range, `deleted_at IS NULL`
  - Return `{ total: number, count: number, hasIncome: boolean, hasExpense: boolean }` (signed: income − expense to show net adjustment)

**2. Update `src/components/dashboard/home/HealthScoreWidget.tsx`**
- Add a second `useEffect` (or Promise.all) to load regularization data
- Add a 3rd compact stat row below the savings/debt grid:
  - Icon: `Scale` (lucide) in amber tone matching the Transactions filter
  - Label: "Régularisations" / "Adjustments"
  - Value: formatted amount + count badge (e.g. `12 500 XOF · 3`)
  - Reliability hint colors:
    - 0 entries → muted "Aucune" / "None" (neutral, good)
    - 1–2 entries → amber (occasional adjustments)
    - 3+ entries → orange/destructive ("Vérifiez votre saisie" / "Check your data entry")
- Use `useProfile().fmt` for currency formatting (consistent with rest of dashboard)
- Add small tooltip/title explaining: "Plus le total est faible, plus votre saisie est fiable"

**3. No memory update needed** — this is a small UI extension; existing `notification-design-system` and `wealth-management` memos cover the patterns used.

## Technical notes
- Use direct supabase client query (no new RPC) — keeps the change scoped and avoids a migration round-trip
- Wrap in try/catch; if no regularization category exists yet, just hide the row (graceful degradation)
- Re-fetch only when `user.id` changes (same lifecycle as the score)
