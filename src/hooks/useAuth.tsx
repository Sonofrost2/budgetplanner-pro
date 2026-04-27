import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    extra?: {
      phone?: string;
      marketingConsent?: boolean;
      smsConsent?: boolean;
      termsAccepted?: boolean;
    },
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    // Set up the auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Only set loading false after first auth event if getSession hasn't resolved yet
      if (!initialized.current) {
        initialized.current = true;
        setLoading(false);
      }
    });

    // Then check initial session - avoid race condition by using ref
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!initialized.current) {
        initialized.current = true;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp: AuthContextType['signUp'] = async (email, password, displayName, extra) => {
    const phone = extra?.phone?.trim() || null;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          phone,
          marketing_consent: !!extra?.marketingConsent,
          sms_consent: !!extra?.smsConsent,
          terms_accepted: !!extra?.termsAccepted,
        },
        emailRedirectTo: window.location.origin,
      },
    });
    // Persist consent + phone on the profile row (created via DB trigger)
    if (!error && data?.user?.id) {
      const userId = data.user.id;
      const now = new Date().toISOString();
      // Wait briefly for the profile-creation trigger then upsert consent fields
      setTimeout(() => {
        supabase
          .from('profiles')
          .update({
            phone,
            marketing_consent: !!extra?.marketingConsent,
            sms_consent: !!extra?.smsConsent,
            terms_accepted_at: extra?.termsAccepted ? now : null,
            consent_updated_at: now,
          })
          .eq('user_id', userId)
          .then(({ error: pErr }) => {
            if (pErr) console.warn('Profile consent update failed:', pErr.message);
          });
      }, 800);
    }
    // Send welcome email (fire-and-forget)
    if (!error) {
      supabase.functions.invoke('send-email', {
        body: { template: 'welcome', to: email, data: { displayName } },
      }).catch(err => console.error('Welcome email error:', err));
    }
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
