

# Plan d'implémentation complet — Toutes les phases

## Phase 1 — Corrections critiques

### 1.1 Corriger BudgetsPage : devise en dur
- Replace hardcoded `EUR` currency formatter in `BudgetsPage.tsx` (line 26) with `useProfile().fmt`, matching the pattern used in all other pages (TransactionsPage, AccountsPage, etc.)

### 1.2 Ajouter des dialogues de confirmation avant suppression
- Create a reusable `ConfirmDeleteDialog` component using `AlertDialog` from shadcn
- Add it to **5 pages** that have delete actions without confirmation:
  - `TransactionsPage.tsx` (line 83-87)
  - `BudgetsPage.tsx` (line 56-58)
  - `AccountsPage.tsx` (line 95-99)
  - `SavingsPage.tsx` (line 70-73)
  - `AdminPricingPage.tsx` (no delete currently, skip)

### 1.3 Créer page gestion des catégories (CRUD)
- Create `src/pages/dashboard/CategoriesPage.tsx` with:
  - List of categories grouped by type (income/expense)
  - Add/Edit dialog with name, icon picker, color picker, type selector
  - Delete with confirmation
  - Uses `useProfile().fmt` pattern
- Add route in `App.tsx`: `/dashboard/categories`
- Add sidebar nav item in `DashboardLayout.tsx` with `Tag` icon
- Add translation keys: `categories`, `addCategory`, `categoryName`, `noCategories`, `iconLabel`, `colorLabel`

### 1.4 Corriger le flux post-signup
- In `Signup.tsx`: after successful signup, instead of `navigate('/dashboard')`, show a success state with "Check your email" message and a link to `/login`. Do NOT redirect to dashboard.

### 1.5 Corriger RLS admin pour subscription_plans
- DB migration: Add a new SELECT policy for admins that lets them see ALL plans (including inactive):
```sql
CREATE POLICY "Admins can read all plans" ON public.subscription_plans
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));
```

## Phase 2 — Améliorations fonctionnelles

### 2.1 Pagination + recherche + filtres sur Transactions
- Add to `TransactionsPage.tsx`:
  - Text search input (filter by description)
  - Date range filter (start/end date inputs)
  - Account filter (Select dropdown)
  - Pagination: 20 items per page, Previous/Next buttons
  - Use client-side filtering + Supabase `.range()` for pagination

### 2.2 Page "Mes reçus"
- Create `src/pages/dashboard/ReceiptsPage.tsx`
  - Query `payment_receipts` table for current user
  - Display as a simple table/list: date, plan, amount, currency, status
  - Add route `/dashboard/receipts` and sidebar nav item with `Receipt` icon
  - Add translation keys: `receipts`, `noReceipts`

### 2.3 Loading skeletons sur toutes les pages
- Add `Skeleton` loading states to: DashboardHome, TransactionsPage, BudgetsPage, AccountsPage, SavingsPage, ReportsPage, ForecastsPage
- Pattern: show skeleton cards/rows while data is loading (`loading` state before fetch resolves)

### 2.4 Filtre par période sur Dashboard Home
- Add a period selector (this week / this month / this quarter / this year) on DashboardHome
- Adjust the date range query accordingly

## Phase 3 — Améliorations UI/UX

### 3.1 Mockup/illustration dans le Hero
- Add a decorative dashboard mockup card (pure CSS/JSX) in HeroSection below the CTAs — a simplified visual of a dashboard with fake stats cards and a mini chart

### 3.2 CTA secondaire fonctionnel
- In `HeroSection.tsx`, make the secondary CTA button scroll to `#features` section using `document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })`

### 3.3 Toggle dark mode sur la landing page
- Add a Sun/Moon toggle button in `Navbar.tsx` next to the Globe language toggle, using `useTheme().toggleTheme`

### 3.4 Meilleurs empty states
- Update empty states in TransactionsPage, BudgetsPage, AccountsPage, SavingsPage with:
  - Larger illustrative icons (lucide)
  - Descriptive subtitle text
  - Direct CTA button to add first item

### 3.5 Animations de transition entre pages
- Wrap `<Outlet />` in DashboardLayout with `framer-motion` `AnimatePresence` + `motion.div` keyed by `location.pathname` for fade+slide transitions

### 3.6 Barre de recherche globale dans le header
- Add a search input in the dashboard header (DashboardLayout)
- Search navigates to transactions page with a search query param pre-filled

### 3.7 Afficher le plan actif dans la sidebar
- Query user's latest payment receipt or subscription status
- Display a small badge/chip in the sidebar bottom area showing "Free" / "Premium" plan name

---

## Translation keys to add (dashTranslations.ts)
Both FR and EN for: `categories`, `addCategory`, `categoryName`, `noCategories`, `iconLabel`, `colorLabel`, `receipts`, `noReceipts`, `search`, `startDate`, `endDate`, `thisWeek`, `thisQuarter`, `thisYear`, `previous`, `next`, `confirmDelete`, `confirmDeleteMessage`, `checkEmail`

## DB Migration needed
- Add admin SELECT policy on `subscription_plans`

## Files to create
- `src/components/dashboard/ConfirmDeleteDialog.tsx`
- `src/pages/dashboard/CategoriesPage.tsx`
- `src/pages/dashboard/ReceiptsPage.tsx`

## Files to modify
- `src/pages/dashboard/BudgetsPage.tsx` — use useProfile, add confirm dialog
- `src/pages/dashboard/TransactionsPage.tsx` — add pagination, search, filters, confirm dialog
- `src/pages/dashboard/AccountsPage.tsx` — add confirm dialog
- `src/pages/dashboard/SavingsPage.tsx` — add confirm dialog
- `src/pages/dashboard/DashboardHome.tsx` — add period filter, loading skeleton
- `src/pages/dashboard/ReportsPage.tsx` — add loading skeleton
- `src/pages/Signup.tsx` — fix post-signup flow
- `src/components/landing/HeroSection.tsx` — add mockup, fix CTA
- `src/components/landing/Navbar.tsx` — add dark mode toggle
- `src/components/dashboard/DashboardLayout.tsx` — add categories/receipts nav, search bar, plan badge, page transitions
- `src/App.tsx` — add new routes
- `src/i18n/dashTranslations.ts` — add new keys

