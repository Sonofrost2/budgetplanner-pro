import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useProfile = () => {
  const { user } = useAuth();
  const [currency, setCurrency] = useState('EUR');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('currency').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data?.currency) setCurrency(data.currency);
        setLoading(false);
      });
  }, [user]);

  const fmt = (n: number, locale: string) =>
    n.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency });

  return { currency, fmt, loading };
};
