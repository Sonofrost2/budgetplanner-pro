import { toast } from 'sonner';
import { showApiError, type ShowApiErrorOpts } from './apiError';

/**
 * Unified notification API — thin wrapper around sonner so every toast
 * in the app shares tone, duration, and action shape.
 *
 * Rules:
 *  - Titles: short, sentence-case, no punctuation stack.
 *  - Descriptions: optional, one clear sentence.
 *  - Actions: pair errors that can be retried with a corrective action.
 */

type Locale = 'fr' | 'en';

export interface NotifyOpts {
  description?: string;
  duration?: number;
  /** Corrective action shown as a button inside the toast. */
  action?: { label: string; onClick: () => void };
  /** Stable id — new toasts with the same id replace the previous one. */
  id?: string | number;
}

const DEFAULTS = {
  success: 3000,
  info: 4000,
  warning: 5000,
  error: 5500,
  loading: 60000,
} as const;

export const notify = {
  success: (title: string, opts: NotifyOpts = {}) =>
    toast.success(title, { duration: DEFAULTS.success, ...opts }),

  info: (title: string, opts: NotifyOpts = {}) =>
    toast(title, { duration: DEFAULTS.info, ...opts }),

  warning: (title: string, opts: NotifyOpts = {}) =>
    toast.warning(title, { duration: DEFAULTS.warning, ...opts }),

  error: (title: string, opts: NotifyOpts = {}) =>
    toast.error(title, { duration: DEFAULTS.error, ...opts }),

  loading: (title: string, opts: Omit<NotifyOpts, 'action'> = {}) =>
    toast.loading(title, { duration: DEFAULTS.loading, ...opts }),

  /** Show a friendly API error with optional retry action. */
  apiError: (err: unknown, locale: Locale = 'fr', opts: ShowApiErrorOpts = {}) =>
    showApiError(err, locale, opts),

  /**
   * Wrap a promise with loading / success / error toasts.
   * `messages.error` may be a static string or a formatter for the caught error.
   */
  promise: <T,>(
    p: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    },
  ) => toast.promise(p, messages),

  dismiss: (id?: string | number) => toast.dismiss(id),
};

export type Notify = typeof notify;