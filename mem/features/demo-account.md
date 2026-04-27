---
name: Public demo account
description: Shared demo@budgetplanner.app user, daily pg_cron reset, /demo route, DemoBanner with upgrade CTA
type: feature
---
Compte démo public partagé : `demo@budgetplanner.app` / `DemoBudget2026!` (créé via auth.users dans la migration). Plan Gratuit, onboarding bypass dans DashboardLayout via `isDemoUserEmail`.

Seed XOF/FR : 5 comptes (Espèces/Wave/Orange/SGCI/Épargne), 8 catégories, 15 transactions sur 30j, 3 budgets mensuels, 1 objectif épargne (Vacances Maroc), 1 dette (moto). Reset quotidien 03h UTC via pg_cron `reset-demo-account-daily` qui appelle `public.reset_demo_account()` (SECURITY DEFINER, EXECUTE révoqué pour anon/authenticated).

Accès : route publique `/demo` (DemoLoginPage auto sign-in + redirect /dashboard) + bouton "Essayer la démo" sur Login/Signup/HeroSection. `<DemoBanner>` sticky en haut du dashboard si user est démo : message éphémère + CTA "Créer mon compte" → /signup.

Helpers : `src/lib/demo.ts` (DEMO_EMAIL, DEMO_PASSWORD, isDemoUserEmail), `src/hooks/useDemoMode.tsx`, fonctions SQL `get_demo_user_id()` / `is_demo_user(uuid)` / `reset_demo_account()`.