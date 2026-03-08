import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useRole = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setLoading(false); return; }
    supabase.from('user_roles').select('role').eq('user_id', user.id)
      .then(({ data }) => {
        setIsAdmin(data?.some((r: any) => r.role === 'admin') || false);
        setLoading(false);
      });
  }, [user]);

  return { isAdmin, loading };
};
