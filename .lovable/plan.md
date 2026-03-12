

## Plan de corrections

### 1. Fix Stats Cards truncation
**Files**: `src/components/dashboard/home/StatsCards.tsx`
- Replace fixed-width cards with a responsive grid that adapts to content
- Use `text-sm` on mobile, `text-base` on desktop for amounts
- Add `whitespace-nowrap` + `overflow-hidden text-ellipsis` with a tooltip showing full amount on hover
- Or better: use compact number formatting for mobile (e.g., "3,7M" instead of "3 734 198 F CFA")
- Make the grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` and let amounts wrap or shrink

### 2. Improve mobile responsive layout
**Files**: `StatsCards.tsx`, `DashboardHome.tsx`
- On mobile (<640px): show 2 key stats (Balance + Net) prominently, collapse others into an expandable row
- Or: reduce to 3 essential cards on mobile, put savings rate + net cash flow behind a "voir plus"

### 3. Add click feedback on interactive cards
**Files**: `AccountsSummaryWidget.tsx`, `BudgetsWidget.tsx`, `SavingsWidget.tsx`, `ForecastWidget.tsx`
- Add `active:scale-[0.98] transition-transform` to clickable cards
- Add subtle `hover:shadow-md` elevation change

### 4. Fix amount formatting
**Files**: `StatsCards.tsx` or `useProfile.tsx`
- Create a `fmtCompact` helper that abbreviates large numbers (3 734 198 → 3,7M) on small screens
- Use `Intl.NumberFormat` with `notation: 'compact'` for mobile

### 5. Minor UX polish
- Add breadcrumb or back-link on AccountsPage when arriving from dashboard filter
- Ensure Solde total card and Synthèse total use same data source (both should use `accounts.real_balance` sum)

### Implementation order
1. StatsCards truncation fix (highest impact)
2. Click feedback on cards
3. Mobile compact formatting
4. Breadcrumb on filtered pages

