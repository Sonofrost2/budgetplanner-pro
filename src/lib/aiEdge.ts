import { supabase } from '@/integrations/supabase/client';

export type AILocale = 'fr' | 'en';

type EdgeErrorPayload = {
  error?: string;
  message?: string;
  message_fr?: string;
  message_en?: string;
  code?: string;
};

const defaultErrorMessage = (locale: AILocale) =>
  locale === 'fr' ? 'Erreur du service IA' : 'AI service error';

export function edgeErrorMessageFromPayload(
  payload: EdgeErrorPayload | null | undefined,
  locale: AILocale,
  fallback = defaultErrorMessage(locale),
) {
  if (!payload) return fallback;
  if (locale === 'fr' && payload.message_fr) return payload.message_fr;
  if (locale === 'en' && payload.message_en) return payload.message_en;
  if (payload.message) return payload.message;
  if (payload.error) return payload.error;
  return fallback;
}

async function parseEdgeErrorPayload(response: Response): Promise<EdgeErrorPayload | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as EdgeErrorPayload;
  } catch {
    return { error: text };
  }
}

export async function getEdgeErrorMessage(
  response: Response,
  locale: AILocale,
  fallback = defaultErrorMessage(locale),
) {
  const payload = await parseEdgeErrorPayload(response);
  return edgeErrorMessageFromPayload(payload, locale, fallback);
}

export async function getAccessToken(locale: AILocale) {
  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session ?? null;
  }

  if (!session?.access_token) {
    throw new Error(
      locale === 'fr'
        ? 'Session invalide. Veuillez vous reconnecter.'
        : 'Invalid session. Please sign in again.',
    );
  }

  return session.access_token;
}

export async function invokeAuthedEdgeFunction<T>(
  functionName: string,
  { body, locale }: { body?: unknown; locale: AILocale },
): Promise<T> {
  const accessToken = await getAccessToken(locale);

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body ?? {}),
  });

  if (!response.ok) {
    throw new Error(await getEdgeErrorMessage(response, locale));
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}
