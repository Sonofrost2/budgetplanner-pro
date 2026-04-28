/**
 * Demo account configuration.
 * The demo account is a real Supabase user that gets reset daily by a pg_cron job.
 * Anyone can sign in with these credentials to explore the app without registering.
 */
 export const DEMO_EMAIL = 'demo@budgetplanner-pro.eurekaci.dev';
export const DEMO_PASSWORD = 'DemoBudget2026!';

export const isDemoUserEmail = (email: string | null | undefined): boolean =>
  (email || '').toLowerCase() === DEMO_EMAIL;