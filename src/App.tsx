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
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import OnboardingPage from "./pages/OnboardingPage";
import LegalPage from "./pages/LegalPage";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import TransactionsPage from "./pages/dashboard/TransactionsPage";
import BudgetsPage from "./pages/dashboard/BudgetsPage";
import ForecastsPage from "./pages/dashboard/ForecastsPage";
import SavingsPage from "./pages/dashboard/SavingsPage";
import ReportsPage from "./pages/dashboard/ReportsPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import PaymentPage from "./pages/dashboard/PaymentPage";
import AccountsPage from "./pages/dashboard/AccountsPage";
import AdminPricingPage from "./pages/dashboard/AdminPricingPage";
import CategoriesPage from "./pages/dashboard/CategoriesPage";
import ReceiptsPage from "./pages/dashboard/ReceiptsPage";
import FamilyPage from "./pages/dashboard/FamilyPage";
import DebtsPage from "./pages/dashboard/DebtsPage";
import RecurringPage from "./pages/dashboard/RecurringPage";

import AboutPage from "./pages/AboutPage";
import BlogPage from "./pages/BlogPage";
import ContactPage from "./pages/ContactPage";
import GuidePage from "./pages/dashboard/GuidePage";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  const routeKey = location.pathname.startsWith('/dashboard') ? '/dashboard' : location.pathname;

  return (
    <AnimatePresence mode="wait">
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
          <Route path="admin/pricing" element={<AdminPricingPage />} />
          
          <Route path="guide" element={<GuidePage />} />
          
        </Route>
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
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
