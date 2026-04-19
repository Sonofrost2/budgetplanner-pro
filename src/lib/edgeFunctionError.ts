// Smart handler for Edge Function 403/429 responses (PLAN_REQUIRED / QUOTA_EXCEEDED).
// Use after `supabase.functions.invoke()` whenever the function is gated by requirePlan().
//
// Example:
//   const { data, error } = await supabase.functions.invoke('ai-chat', { body });
//   if (handleEdgeError(error, data, { locale, navigate })) return;
//   // ... use data normally

import { toast } from 'sonner';
import type { NavigateFunction } from 'react-router-dom';

interface PlanError {
  error?: string;
  code?: 'PLAN_REQUIRED' | 'QUOTA_EXCEEDED';
  required?: string[];
  current?: string;
  used?: number;
  limit?: number;
  message_fr?: string;
  message_en?: string;
  upgrade_url?: string;
}

interface HandlerOpts {
  locale: 'fr' | 'en';
  navigate?: NavigateFunction;
  /** Auto-redirect to /dashboard/payment when PLAN_REQUIRED. Default true. */
  autoRedirect?: boolean;
}

/**
 * Returns true if the error was handled (caller should stop), false otherwise.
 * Accepts either a Supabase FunctionsHttpError or the raw JSON body.
 */
export function handleEdgeError(
  error: any,
  data: any,
  { locale, navigate, autoRedirect = true }: HandlerOpts,
): boolean {
  // Case 1: data is the explicit error payload
  const payload: PlanError | null =
    data && typeof data === 'object' && (data.code === 'PLAN_REQUIRED' || data.code === 'QUOTA_EXCEEDED')
      ? data
      : (error?.context?.body && typeof error.context.body === 'object' ? error.context.body : null) ||
        (error?.message && typeof error.message === 'string' && error.message.startsWith('{')
          ? safeJson(error.message)
          : null);

  if (!payload?.code) {
    if (error) {
      toast.error(locale === 'fr' ? 'Une erreur est survenue.' : 'An error occurred.', {
        description: error.message?.slice(0, 200),
      });
      return true;
    }
    return false;
  }

  const msg = locale === 'fr' ? payload.message_fr : payload.message_en;

  if (payload.code === 'PLAN_REQUIRED') {
    toast.error(locale === 'fr' ? '🔒 Plan requis' : '🔒 Plan required', {
      description: msg,
      action: navigate
        ? {
            label: locale === 'fr' ? 'Mettre à niveau' : 'Upgrade',
            onClick: () => navigate('/dashboard/payment'),
          }
        : undefined,
      duration: 6000,
    });
    if (autoRedirect && navigate) {
      setTimeout(() => navigate('/dashboard/payment'), 1500);
    }
    return true;
  }

  if (payload.code === 'QUOTA_EXCEEDED') {
    toast.warning(locale === 'fr' ? '⏱ Quota quotidien atteint' : '⏱ Daily quota reached', {
      description: msg,
      action: navigate
        ? {
            label: locale === 'fr' ? 'Voir les plans' : 'See plans',
            onClick: () => navigate('/dashboard/payment'),
          }
        : undefined,
      duration: 8000,
    });
    return true;
  }

  return false;
}

function safeJson(s: string): PlanError | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
