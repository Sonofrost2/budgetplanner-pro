import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export const useProfile = () => {
  const { user } = useAuth();

  const { data, isLoading: loading } = useQuery({
    queryKey: ['profile-currency', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('currency').eq('user_id', user!.id).single();
      return data?.currency || 'EUR';
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const currency = data || 'EUR';

  const fmt = (n: number, locale: string) =>
    n.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency });

  return { currency, fmt, loading };
};
