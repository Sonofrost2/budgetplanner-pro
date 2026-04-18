import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AIConversation = {
  id: string;
  title: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type AIMessage = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
};

export const useAIConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(30);
    setConversations((data || []) as AIConversation[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const createConversation = useCallback(async (title = 'Nouvelle conversation'): Promise<string | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({ user_id: user.id, title })
      .select('id')
      .single();
    if (error || !data) return null;
    refresh();
    return data.id;
  }, [user, refresh]);

  const loadMessages = useCallback(async (conversationId: string): Promise<AIMessage[]> => {
    const { data } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    return (data || []) as AIMessage[];
  }, []);

  const archiveConversation = useCallback(async (id: string) => {
    await supabase.from('ai_conversations').update({ archived: true }).eq('id', id);
    refresh();
  }, [refresh]);

  const deleteConversation = useCallback(async (id: string) => {
    await supabase.from('ai_conversations').delete().eq('id', id);
    refresh();
  }, [refresh]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    await supabase.from('ai_conversations').update({ title }).eq('id', id);
    refresh();
  }, [refresh]);

  const monthlyUsage = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    const start = new Date();
    start.setDate(1); start.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('ai_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'user')
      .gte('created_at', start.toISOString());
    return count || 0;
  }, [user]);

  return { conversations, loading, refresh, createConversation, loadMessages, archiveConversation, deleteConversation, renameConversation, monthlyUsage };
};
