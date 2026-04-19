import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/integrations/supabase/types';

export type FamilyCategoryWithGroup = Tables<'family_categories'> & {
  group_name?: string | null;
};

/**
 * Fetches all family categories visible to the current user (across all groups they belong to).
 * Used to populate the "Catégorie Famille" selector in TransactionForm.
 * RLS automatically filters to groups where user is a member.
 */
export const useFamilyCategories = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['family-categories', user?.id],
    queryFn: async (): Promise<FamilyCategoryWithGroup[]> => {
      const { data, error } = await supabase
        .from('family_categories')
        .select('*, family_groups(name)')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        ...c,
        group_name: c.family_groups?.name ?? null,
      }));
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};

/**
 * Returns the family root category of the current user (categories.is_family_root = true).
 * Auto-created by the ensure_user_family_root() DB function.
 */
export const useFamilyRootCategory = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['family-root-category', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_family_root', true)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });
};
