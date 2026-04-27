import { useAuth } from '@/hooks/useAuth';
import { isDemoUserEmail } from '@/lib/demo';

/**
 * Returns true when the currently signed-in user is the public demo account.
 * Use to show the demo banner, throttle destructive actions, or surface upgrade CTAs.
 */
export const useDemoMode = (): boolean => {
  const { user } = useAuth();
  return isDemoUserEmail(user?.email);
};