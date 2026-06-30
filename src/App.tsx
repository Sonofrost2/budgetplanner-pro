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
import { Suspense, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Eager-loaded (landing only - critical for LCP on first visit)
import Index from "./pages/Index";

// Auth pages (lazy - not on initial landing load)
const Login = lazyWithRetry(() => import("./pages/Login"), "login-page");
const Signup = lazyWithRetry(() => import("./pages/Signup"), "signup-page");
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"), "forgot-password-page");
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"), "reset-password-page");
const NotFound = lazyWithRetry(() => import("./pages/NotFound"), "not-found-page");
const DemoLoginPage = lazyWithRetry(() => import("./pages/DemoLoginPage"), "demo-login-page");

// Lazy-loaded pages
const OnboardingPage = lazyWithRetry(() => import("./pages/OnboardingPage"), "onboarding-page");
const LegalPage = lazyWithRetry(() => import("./pages/LegalPage"), "legal-page");
const AboutPage = lazyWithRetry(() => import("./pages/AboutPage"), "about-page");
const BlogPage = lazyWithRetry(() => import("./pages/BlogPage"), "blog-page");
const ContactPage = lazyWithRetry(() => import("./pages/ContactPage"), "contact-page");

// Dashboard (lazy)
const DashboardLayout = lazyWithRetry(() => import("./components/dashboard/DashboardLayout"), "dashboard-layout");
const DashboardHome = lazyWithRetry(() => import("./pages/dashboard/DashboardHome"), "dashboard-home");
const TransactionsPage = lazyWithRetry(() => import("./pages/dashboard/TransactionsPage"), "transactions-page");
const BudgetsPage = lazyWithRetry(() => import("./pages/dashboard/BudgetsPage"), "budgets-page");
const ForecastsPage = lazyWithRetry(() => import("./pages/dashboard/ForecastsPage"), "forecasts-page");
const SavingsPage = lazyWithRetry(() => import("./pages/dashboard/SavingsPage"), "savings-page");
const BudgetSavingsLinksPage = lazyWithRetry(() => import("./pages/dashboard/BudgetSavingsLinksPage"), "budget-savings-links-page");
const ReportsPage = lazyWithRetry(() => import("./pages/dashboard/ReportsPage"), "reports-page");
const SettingsPage = lazyWithRetry(() => import("./pages/dashboard/SettingsPage"), "settings-page");
const PaymentPage = lazyWithRetry(() => import("./pages/dashboard/PaymentPage"), "payment-page");
const AccountsPage = lazyWithRetry(() => import("./pages/dashboard/AccountsPage"), "accounts-page");
const AdminPricingPage = lazyWithRetry(() => import("./pages/dashboard/AdminPricingPage"), "admin-pricing-page");
const AdminUsersPage = lazyWithRetry(() => import("./pages/dashboard/AdminUsersPage"), "admin-users-page");
const AdminSecurityPage = lazyWithRetry(() => import("./pages/dashboard/AdminSecurityPage"), "admin-security-page");
const AdminSmsTemplatesPage = lazyWithRetry(() => import("./pages/dashboard/AdminSmsTemplatesPage"), "admin-sms-templates-page");
const AdminSmsLogsPage = lazyWithRetry(() => import("./pages/dashboard/AdminSmsLogsPage"), "admin-sms-logs-page");
const AdminNotificationMetricsPage = lazyWithRetry(() => import("./pages/dashboard/AdminNotificationMetricsPage"), "admin-notification-metrics-page");
const AdminBillingPage = lazyWithRetry(() => import("./pages/dashboard/AdminBillingPage"), "admin-billing-page");
const CategoriesPage = lazyWithRetry(() => import("./pages/dashboard/CategoriesPage"), "categories-page");
const ReceiptsPage = lazyWithRetry(() => import("./pages/dashboard/ReceiptsPage"), "receipts-page");
const FamilyPage = lazyWithRetry(() => import("./pages/dashboard/FamilyPage"), "family-page");
const DebtsPage = lazyWithRetry(() => import("./pages/dashboard/DebtsPage"), "debts-page");
const RecurringPage = lazyWithRetry(() => import("./pages/dashboard/RecurringPage"), "recurring-page");
const WealthPage = lazyWithRetry(() => import("./pages/dashboard/WealthPage"), "wealth-page");
const GuidePage = lazyWithRetry(() => import("./pages/dashboard/GuidePage"), "guide-page");
const FamilyAcceptPage = lazyWithRetry(() => import("./pages/FamilyAcceptPage"), "family-accept-page");
const NotificationsPage = lazyWithRetry(() => import("./pages/dashboard/NotificationsPage"), "notifications-page");

const queryClient = new QueryClient();

const PageLoader = forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} className="min-h-screen flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
));

PageLoader.displayName = "PageLoader";

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
          <Route path="/demo" element={<PageTransition><DemoLoginPage /></PageTransition>} />
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
            <Route path="links" element={<BudgetSavingsLinksPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
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
            <Route path="admin/sms-templates" element={<AdminSmsTemplatesPage />} />
            <Route path="admin/sms-logs" element={<AdminSmsLogsPage />} />
            <Route path="admin/notification-metrics" element={<AdminNotificationMetricsPage />} />
            <Route path="admin/billing" element={<AdminBillingPage />} />
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
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AnimatedRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
