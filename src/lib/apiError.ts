import { toast } from 'sonner';

type Locale = 'fr' | 'en';

/**
 * Strip technical prefixes like `CODE_NAME:` or Postgres/PostgREST noise
 * from a raw error message so it never leaks to the user.
 */
function sanitize(raw: string): string {
  let msg = String(raw || '').trim();
  // Strip leading SHOUTY_CODE: prefix (potentially repeated).
  msg = msg.replace(/^(?:[A-Z][A-Z0-9_]{3,}:\s*)+/g, '');
  // Strip Postgres error hints like "new row for relation ..."
  msg = msg.replace(/\bnew row for relation "[^"]+" violates[^.]*\.?/i, '').trim();
  return msg;
}

function extractCode(raw: string): string | null {
  const m = String(raw || '').match(/\b([A-Z][A-Z0-9_]{3,})(?=:)/);
  return m ? m[1] : null;
}

function extractLimit(raw: string): number | null {
  const m = String(raw || '').match(/(\d{1,4})\s*(?:transactions?|per month|par mois|\))/i);
  return m ? Number(m[1]) : null;
}

export interface FriendlyError {
  title: string;
  description?: string;
  action?: { label: string; href: string };
}

/**
 * Map a raw API/DB error into a user-facing message. Never exposes raw codes.
 */
export function toFriendlyError(err: unknown, locale: Locale = 'fr'): FriendlyError {
  const raw = (err as any)?.message ?? (typeof err === 'string' ? err : '');
  const code = extractCode(raw);
  const isFr = locale === 'fr';

  if (code === 'PLAN_LIMIT_REACHED') {
    const limit = extractLimit(raw) ?? 15;
    return {
      title: isFr
        ? `Limite du plan Gratuit atteinte : ${limit} transactions/mois`
        : `Free plan limit reached: ${limit} transactions/month`,
      description: isFr
        ? 'Passez au plan Pro pour continuer à saisir sans limite.'
        : 'Upgrade to Pro to keep adding transactions without limits.',
      action: {
        label: isFr ? 'Voir les plans' : 'View plans',
        href: '/dashboard/payment',
      },
    };
  }

  // Common auth/permission cases
  const lower = String(raw).toLowerCase();
  if (lower.includes('row-level security') || lower.includes('permission denied') || lower.includes('not authorized')) {
    return {
      title: isFr ? 'Action non autorisée' : 'Action not allowed',
      description: isFr
        ? "Vous n'avez pas les droits requis pour effectuer cette action."
        : "You don't have the required permissions for this action.",
    };
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return {
      title: isFr ? 'Connexion perdue' : 'Connection lost',
      description: isFr
        ? 'Vérifiez votre connexion Internet et réessayez.'
        : 'Please check your internet connection and try again.',
    };
  }
  if (lower.includes('duplicate key') || lower.includes('unique constraint')) {
    return {
      title: isFr ? 'Doublon détecté' : 'Duplicate detected',
      description: isFr
        ? 'Cet enregistrement existe déjà.'
        : 'This record already exists.',
    };
  }

  const clean = sanitize(raw);
  return {
    title: clean || (isFr ? 'Une erreur est survenue' : 'Something went wrong'),
  };
}

/**
 * Show an API error using a friendly, translated toast — never a raw code.
 */
export function showApiError(err: unknown, locale: Locale = 'fr'): void {
  const f = toFriendlyError(err, locale);
  toast.error(f.title, {
    description: f.description,
    action: f.action
      ? {
          label: f.action.label,
          onClick: () => {
            if (typeof window !== 'undefined') window.location.href = f.action!.href;
          },
        }
      : undefined,
  });
}