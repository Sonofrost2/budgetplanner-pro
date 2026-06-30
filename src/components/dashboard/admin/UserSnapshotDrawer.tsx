// Silent admin observation drawer — opens a comprehensive read-only view of any user.
// Calls the `admin-user-action` edge function with action `get_user_snapshot`.
// Nothing is logged on the user's side and nothing is recorded in audit_logs.

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, EyeOff, Wallet, Activity, Brain, Users2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

type Snapshot = any; // shape mirrors the SQL function output

interface Props {
  userId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const UserSnapshotDrawer = ({ userId, open, onOpenChange }: Props) => {
  const { locale } = useLanguage();
  const isFr = locale === 'fr';
  const dl = isFr ? fr : enUS;
  const [loading, setLoading] = useState(false);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    setError(null);
    setSnap(null);
    supabase.functions
      .invoke('admin-user-action', { body: { action: 'get_user_snapshot', user_id: userId } })
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
        } else {
          setSnap(data?.snapshot ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, [open, userId]);

  const fmtMoney = (n: number, ccy?: string | null) => {
    const code = (ccy || DEFAULT_CURRENCY).toUpperCase();
    try {
      return new Intl.NumberFormat(isFr ? 'fr-FR' : 'en-US', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(n || 0);
    } catch {
      return `${Math.round(n || 0)} ${code}`;
    }
  };
  const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd MMM yyyy HH:mm', { locale: dl }) : '—');

  const profile = snap?.profile;
  const totals = snap?.totals;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl p-0 overflow-hidden">
        <SheetHeader className="p-5 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 ring-2 ring-primary/30">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback>{(profile?.display_name || profile?.email || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle className="flex items-center gap-2">
                {profile?.display_name || profile?.email || (isFr ? 'Utilisateur' : 'User')}
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <EyeOff className="h-3 w-3" />
                  {isFr ? 'Mode silencieux' : 'Silent mode'}
                </Badge>
              </SheetTitle>
              <SheetDescription className="text-xs">
                {profile?.email} · {snap?.effective_plan?.toUpperCase()} · {isFr ? 'Inscrit' : 'Joined'} {fmtDate(profile?.created_at)}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <div className="p-6 text-destructive text-sm">{error}</div>}

        {snap && !loading && (
          <ScrollArea className="h-[calc(100vh-110px)]">
            <Tabs defaultValue="finance" className="p-4">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="finance"><Wallet className="h-3.5 w-3.5 mr-1" />Finance</TabsTrigger>
                <TabsTrigger value="activity"><Activity className="h-3.5 w-3.5 mr-1" />{isFr ? 'Activité' : 'Activity'}</TabsTrigger>
                <TabsTrigger value="ai"><Brain className="h-3.5 w-3.5 mr-1" />IA</TabsTrigger>
                <TabsTrigger value="family"><Users2 className="h-3.5 w-3.5 mr-1" />{isFr ? 'Famille' : 'Family'}</TabsTrigger>
                <TabsTrigger value="security"><ShieldAlert className="h-3.5 w-3.5 mr-1" />{isFr ? 'Sécurité' : 'Security'}</TabsTrigger>
              </TabsList>

              {/* FINANCE */}
              <TabsContent value="finance" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Stat label={isFr ? 'Patrimoine net' : 'Net worth'} value={fmtMoney(totals?.net_worth || 0, profile?.currency)} />
                  <Stat label={isFr ? 'Revenus 30j' : 'Income 30d'} value={fmtMoney(totals?.income_30d || 0, profile?.currency)} positive />
                  <Stat label={isFr ? 'Dépenses 30j' : 'Expenses 30d'} value={fmtMoney(totals?.expense_30d || 0, profile?.currency)} negative />
                  <Stat label={isFr ? 'Transactions' : 'Transactions'} value={String(totals?.tx_count || 0)} />
                </div>

                <Section title={isFr ? `Comptes (${snap.accounts.length})` : `Accounts (${snap.accounts.length})`}>
                  {snap.accounts.map((a: any) => (
                    <Row key={a.id} left={`${a.icon} ${a.name}`} right={fmtMoney(a.real_balance, profile?.currency)} sub={a.type} />
                  ))}
                </Section>

                <Section title={isFr ? `Transactions récentes (${snap.recent_transactions.length})` : `Recent transactions (${snap.recent_transactions.length})`}>
                  {snap.recent_transactions.slice(0, 25).map((t: any) => (
                    <Row
                      key={t.id}
                      left={`${t.category_icon || '•'} ${t.description}`}
                      right={`${t.type === 'expense' ? '-' : '+'}${fmtMoney(t.amount, profile?.currency)}`}
                      sub={`${t.date} · ${t.category_name || '—'} · ${t.account_name || '—'}`}
                      tone={t.type === 'expense' ? 'negative' : 'positive'}
                    />
                  ))}
                </Section>

                <div className="grid md:grid-cols-2 gap-3">
                  <Section title={isFr ? `Budgets (${snap.budgets.length})` : `Budgets (${snap.budgets.length})`}>
                    {snap.budgets.map((b: any) => (
                      <Row key={b.id} left={b.name} right={fmtMoney(b.amount, profile?.currency)} sub={`${b.period} · ${b.budget_type}`} />
                    ))}
                  </Section>
                  <Section title={isFr ? `Épargne (${snap.savings_goals.length})` : `Savings (${snap.savings_goals.length})`}>
                    {snap.savings_goals.map((g: any) => (
                      <Row key={g.id} left={g.name} right={`${fmtMoney(g.current_amount, profile?.currency)} / ${fmtMoney(g.target_amount, profile?.currency)}`} sub={g.status} />
                    ))}
                  </Section>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <Section title={isFr ? `Dettes (${snap.debts.length})` : `Debts (${snap.debts.length})`}>
                    {snap.debts.map((d: any) => (
                      <Row key={d.id} left={d.creditor_name} right={`${fmtMoney(d.paid_amount || 0, profile?.currency)} / ${fmtMoney(d.total_amount, profile?.currency)}`} sub={`${d.interest_rate}%`} />
                    ))}
                  </Section>
                  <Section title={isFr ? `Actifs (${snap.assets.length})` : `Assets (${snap.assets.length})`}>
                    {snap.assets.map((a: any) => (
                      <Row key={a.id} left={a.name} right={fmtMoney(a.current_value, a.currency)} sub={a.category} />
                    ))}
                  </Section>
                </div>
              </TabsContent>

              {/* ACTIVITY */}
              <TabsContent value="activity" className="space-y-4 mt-4">
                <Section title={isFr ? 'Connexions & profil' : 'Sessions & profile'}>
                  <Row left={isFr ? 'Dernière connexion' : 'Last sign-in'} right={fmtDate(profile?.last_sign_in_at)} />
                  <Row left={isFr ? 'Email confirmé' : 'Email confirmed'} right={fmtDate(profile?.email_confirmed_at)} />
                  <Row left={isFr ? 'Onboarding terminé' : 'Onboarding done'} right={profile?.onboarding_completed ? '✓' : '—'} />
                  <Row left={isFr ? 'Banni jusqu\'à' : 'Banned until'} right={fmtDate(profile?.banned_until)} />
                </Section>

                <Section title={isFr ? `Usage IA aujourd'hui` : `Today's AI usage`}>
                  {(snap.usage_today || []).length === 0 && <Empty />}
                  {(snap.usage_today || []).map((u: any) => (
                    <Row key={u.feature} left={u.feature} right={String(u.count)} />
                  ))}
                </Section>

                <Section title={isFr ? `Événements récents (${snap.recent_audit.length})` : `Recent events (${snap.recent_audit.length})`}>
                  {snap.recent_audit.map((a: any, i: number) => (
                    <Row key={i} left={`${a.event_type} · ${a.event_subtype || ''}`} right={a.status} sub={`${fmtDate(a.created_at)} · ${a.ip_address || '—'}`} tone={a.status === 'denied' ? 'negative' : undefined} />
                  ))}
                </Section>
              </TabsContent>

              {/* AI */}
              <TabsContent value="ai" className="space-y-4 mt-4">
                {snap.ai_conversations.length === 0 && <Empty />}
                {snap.ai_conversations.map((c: any) => (
                  <Card key={c.id} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-sm">{c.title}</div>
                      <Badge variant="outline">{c.msg_count} msg</Badge>
                    </div>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {(c.recent_messages || []).map((m: any, i: number) => (
                        <div key={i} className={`text-xs p-2 rounded ${m.role === 'user' ? 'bg-primary/10' : 'bg-muted'}`}>
                          <div className="font-semibold opacity-70 mb-0.5">{m.role}</div>
                          <div className="whitespace-pre-wrap line-clamp-4">{m.content}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </TabsContent>

              {/* FAMILY */}
              <TabsContent value="family" className="space-y-4 mt-4">
                <Section title={isFr ? `Groupes (${snap.families.length})` : `Groups (${snap.families.length})`}>
                  {snap.families.length === 0 && <Empty />}
                  {snap.families.map((f: any) => (
                    <Row key={f.id} left={f.name} right={`${f.member_count} ${isFr ? 'membres' : 'members'}`} sub={`${f.role} · ${f.currency}`} />
                  ))}
                </Section>
              </TabsContent>

              {/* SECURITY */}
              <TabsContent value="security" className="space-y-4 mt-4">
                <Section title={isFr ? `Appareils (${snap.devices.length})` : `Devices (${snap.devices.length})`}>
                  {snap.devices.length === 0 && <Empty />}
                  {snap.devices.map((d: any, i: number) => (
                    <Row
                      key={i}
                      left={d.ip_address || '—'}
                      right={fmtDate(d.last_seen_at)}
                      sub={(d.user_agent || '').slice(0, 80)}
                    />
                  ))}
                </Section>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
};

const Stat = ({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) => (
  <Card className="p-3">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={`text-sm font-semibold mt-1 ${positive ? 'text-emerald-500' : negative ? 'text-rose-500' : ''}`}>{value}</div>
  </Card>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card className="p-3">
    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</div>
    <div className="space-y-1">{children}</div>
  </Card>
);

const Row = ({ left, right, sub, tone }: { left: string; right?: string; sub?: string; tone?: 'positive' | 'negative' }) => (
  <div className="flex items-start justify-between text-xs py-1 border-b border-border/40 last:border-0">
    <div className="flex-1 min-w-0">
      <div className="truncate">{left}</div>
      {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
    </div>
    {right && (
      <div className={`ml-3 font-medium whitespace-nowrap ${tone === 'positive' ? 'text-emerald-500' : tone === 'negative' ? 'text-rose-500' : ''}`}>
        {right}
      </div>
    )}
  </div>
);

const Empty = () => <div className="text-xs text-muted-foreground italic py-2">—</div>;
