import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

// Eager-loaded (landing + auth - small, needed immediately)
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));

// Dashboard (lazy)
const DashboardLayout = lazy(() => import("./components/dashboard/DashboardLayout"));
const DashboardHome = lazy(() => import("./pages/dashboard/DashboardHome"));
const TransactionsPage = lazy(() => import("./pages/dashboard/TransactionsPage"));
const BudgetsPage = lazy(() => import("./pages/dashboard/BudgetsPage"));
const ForecastsPage = lazy(() => import("./pages/dashboard/ForecastsPage"));
const SavingsPage = lazy(() => import("./pages/dashboard/SavingsPage"));
const ReportsPage = lazy(() => import("./pages/dashboard/ReportsPage"));
const SettingsPage = lazy(() => import("./pages/dashboard/SettingsPage"));
const PaymentPage = lazy(() => import("./pages/dashboard/PaymentPage"));
const AccountsPage = lazy(() => import("./pages/dashboard/AccountsPage"));
const AdminPricingPage = lazy(() => import("./pages/dashboard/AdminPricingPage"));
const AdminUsersPage = lazy(() => import("./pages/dashboard/AdminUsersPage"));
const AdminSecurityPage = lazy(() => import("./pages/dashboard/AdminSecurityPage"));
const CategoriesPage = lazy(() => import("./pages/dashboard/CategoriesPage"));
const ReceiptsPage = lazy(() => import("./pages/dashboard/ReceiptsPage"));
const FamilyPage = lazy(() => import("./pages/dashboard/FamilyPage"));
const DebtsPage = lazy(() => import("./pages/dashboard/DebtsPage"));
const RecurringPage = lazy(() => import("./pages/dashboard/RecurringPage"));
const WealthPage = lazy(() => import("./pages/dashboard/WealthPage"));
const GuidePage = lazy(() => import("./pages/dashboard/GuidePage"));
const FamilyAcceptPage = lazy(() => import("./pages/FamilyAcceptPage"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  const routeKey = location.pathname.startsWith('/dashboard') ? '/dashboard' : location.pathname;

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<PageLoader />}>
        <Routes location={location} key={routeKey}>
          <Route path="/" element={<PageTransition><Index /></PageTransition>} />
          <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
          <Route path="/signup" element={<PageTransition><Signup /></PageTransition>} />
          <Route path="/forgot-password" element={<PageTransition><ForgotPassword /></PageTransition>} />
          <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
          <Route path="/onboarding" element={<PageTransition><OnboardingPage /></PageTransition>} />
          <Route path="/legal/:slug" element={<PageTransition><LegalPage /></PageTransition>} />
          <Route path="/about" element={<PageTransition><AboutPage /></PageTransition>} />
          <Route path="/blog" element={<PageTransition><BlogPage /></PageTransition>} />
          <Route path="/contact" element={<PageTransition><ContactPage /></PageTransition>} />
          <Route path="/family/accept/:token" element={<PageTransition><FamilyAcceptPage /></PageTransition>} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="budgets" element={<BudgetsPage />} />
            <Route path="forecasts" element={<ForecastsPage />} />
            <Route path="savings" element={<SavingsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="payment" element={<PaymentPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="receipts" element={<ReceiptsPage />} />
            <Route path="family" element={<FamilyPage />} />
            <Route path="debts" element={<DebtsPage />} />
            <Route path="recurring" element={<RecurringPage />} />
            <Route path="wealth" element={<WealthPage />} />
            <Route path="admin/pricing" element={<AdminPricingPage />} />
            <Route path="admin/users" element={<AdminUsersPage />} />
            <Route path="admin/security" element={<AdminSecurityPage />} />
            <Route path="guide" element={<GuidePage />} />
          </Route>
          <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AnimatedRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
