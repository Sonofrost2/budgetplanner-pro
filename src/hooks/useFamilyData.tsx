import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export interface MemberWithProfile extends Tables<'family_members'> {
  display_name: string | null;
  avatar_url: string | null;
}

export interface FamilyDashboard {
  total_income: number;
  total_expense: number;
  net: number;
  members: { user_id: string; display_name: string; income: number; expense: number; tx_count: number }[];
  top_categories: { category_id: string | null; name: string | null; icon: string | null; color: string | null; total: number }[];
  shared_budgets: { budget_id: string; name: string; amount: number; spent: number; pct: number }[];
}

export interface FamilyTransaction {
  id: string; user_id: string; amount: number; type: string; date: string;
  description: string; category_name: string | null; category_icon: string | null; display_name: string | null;
}

export const useFamilyData = (selectedGroupId: string | null, periodStart: string, periodEnd: string) => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Tables<'family_groups'>[]>([]);
  const [members, setMembers] = useState<Record<string, MemberWithProfile[]>>({});
  const [pendingForMe, setPendingForMe] = useState<Tables<'family_invitations'>[]>([]);
  const [sentInvitations, setSentInvitations] = useState<Tables<'family_invitations'>[]>([]);
  const [budgets, setBudgets] = useState<Tables<'budgets'>[]>([]);
  const [sharedBudgets, setSharedBudgets] = useState<(Tables<'shared_budgets'> & { budgets?: Pick<Tables<'budgets'>, 'name' | 'amount' | 'period'> })[]>([]);
  const [dashboard, setDashboard] = useState<FamilyDashboard | null>(null);
  const [activity, setActivity] = useState<FamilyTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [groupsRes, invRes, budRes, sharedRes] = await Promise.all([
      supabase.from('family_groups').select('*').order('created_at', { ascending: false }),
      supabase.from('family_invitations').select('*').eq('status', 'pending'),
      supabase.from('budgets').select('*').eq('user_id', user.id).is('deleted_at', null),
      supabase.from('shared_budgets').select('*, budgets(name, amount, period)'),
    ]);

    const grps = groupsRes.data || [];
    setGroups(grps);
    setBudgets(budRes.data || []);
    setSharedBudgets((sharedRes.data || []) as typeof sharedBudgets);

    // Members per group with profiles
    const map: Record<string, MemberWithProfile[]> = {};
    await Promise.all(grps.map(async (g) => {
      const [{ data: rawMembers }, { data: profiles }] = await Promise.all([
        supabase.from('family_members').select('*').eq('group_id', g.id),
        supabase.rpc('get_family_member_profiles', { p_group_id: g.id }),
      ]);
      const profileMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
      (profiles || []).forEach((p) => profileMap.set(p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url }));
      map[g.id] = (rawMembers || []).map((m) => ({
        ...m,
        display_name: profileMap.get(m.user_id)?.display_name ?? null,
        avatar_url: profileMap.get(m.user_id)?.avatar_url ?? null,
      }));
    }));
    setMembers(map);

    // Invitations split
    const userEmail = user.email?.toLowerCase();
    const allInv = invRes.data || [];
    setSentInvitations(allInv.filter((i) => i.invited_by === user.id));
    setPendingForMe(allInv.filter((i) => i.invited_email.toLowerCase() === userEmail));

    // Dashboard + activity for selected group
    if (selectedGroupId) {
      const [dashRes, txRes] = await Promise.all([
        supabase.rpc('get_family_dashboard', { p_group_id: selectedGroupId, p_start_date: periodStart, p_end_date: periodEnd }),
        supabase.rpc('get_family_transactions', { p_group_id: selectedGroupId, p_limit: 100 }),
      ]);
      setDashboard((dashRes.data as unknown as FamilyDashboard) || null);
      setActivity((txRes.data || []) as FamilyTransaction[]);
    } else {
      setDashboard(null);
      setActivity([]);
    }

    setLoading(false);
  }, [user, selectedGroupId, periodStart, periodEnd]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime sync
  useEffect(() => {
    const channel = supabase
      .channel('family-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_invitations' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_members' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_budgets' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  return { groups, members, pendingForMe, sentInvitations, budgets, sharedBudgets, dashboard, activity, loading, refetch: fetchAll };
};
