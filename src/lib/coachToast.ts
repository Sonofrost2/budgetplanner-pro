import { toast } from 'sonner';

/**
 * Coach Financier — unified toast helper with consistent emoji + tone.
 * Use this instead of raw `toast.*` for user-facing financial events
 * so we keep a coherent voice across the app.
 */

type ToastOpts = {
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
};

const wrap = (emoji: string, message: string) => `${emoji}  ${message}`;

export const coachToast = {
  /** Win / goal reached / positive milestone */
  win: (message: string, opts?: ToastOpts) =>
    toast.success(wrap('🎉', message), { duration: 4500, ...opts }),

  /** Saved / Created / Updated successfully */
  saved: (message: string, opts?: ToastOpts) =>
    toast.success(wrap('✅', message), { duration: 3000, ...opts }),

  /** Friendly reminder, non-blocking */
  remind: (message: string, opts?: ToastOpts) =>
    toast(wrap('💡', message), { duration: 4500, ...opts }),

  /** Caution — user should pay attention but no error */
  warn: (message: string, opts?: ToastOpts) =>
    toast.warning(wrap('⚠️', message), { duration: 5000, ...opts }),

  /** Hard error / failure */
  fail: (message: string, opts?: ToastOpts) =>
    toast.error(wrap('🚫', message), { duration: 5500, ...opts }),

  /** Money / transaction event */
  money: (message: string, opts?: ToastOpts) =>
    toast.success(wrap('💰', message), { duration: 3500, ...opts }),

  /** Coach-tone hint / suggestion */
  coach: (message: string, opts?: ToastOpts) =>
    toast(wrap('🧭', message), { duration: 5500, ...opts }),

  /** Pass-through to raw sonner for special cases */
  raw: toast,
};
