import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import TransactionsPage from "./pages/dashboard/TransactionsPage";
import BudgetsPage from "./pages/dashboard/BudgetsPage";
import ForecastsPage from "./pages/dashboard/ForecastsPage";
import SavingsPage from "./pages/dashboard/SavingsPage";
import ReportsPage from "./pages/dashboard/ReportsPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import PaymentPage from "./pages/dashboard/PaymentPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<DashboardHome />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="budgets" element={<BudgetsPage />} />
                <Route path="forecasts" element={<ForecastsPage />} />
                <Route path="savings" element={<SavingsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
