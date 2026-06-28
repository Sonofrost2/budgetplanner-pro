// Superadmin billing console: payment receipts, refund tracking & KPIs.
// All data goes through SECURITY DEFINER RPCs gated on the admin role.
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Loader2, Download, RefreshCw, TrendingUp, Users, Percent, Wallet, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { formatAmount } from '@/lib/currency';

type Receipt = {
  id: string;
  created_at: string;
  user_id: string;
  user_email: string | null;
  display_name: string | null;
  plan_name: string;
  amount: number;
  currency: string;
  payment_token: string | null;
  payment_method: string | null;
  status: string;
  refunded_at: string | null;
  refund_reason: string | null;
  billing_cycle: string | null;
};

type Kpis = {
  mrr_xof: number;
  active_by_plan: Record<string, number>;
  refund_rate_90d: number;
  total_receipts_90d: number;
  refunded_receipts_90d: number;
  revenue_month_xof: number;
  revenue_month_by_currency: Record<string, number>;
};

const STATUS_BADGE: Record<string, { fr: string; en: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  confirmed: { fr: 'Confirmé', en: 'Confirmed', variant: 'default' },
  pending: { fr: 'En attente', en: 'Pending', variant: 'secondary' },
  refunded: { fr: 'Remboursé', en: 'Refunded', variant: 'destructive' },
  failed: { fr: 'Échoué', en: 'Failed', variant: 'outline' },
};

const AdminBillingPage = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const isFr = locale === 'fr';
  const dl = isFr ? fr : enUS;

  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);

  // Filters
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState<string>(firstOfMonth.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>('');
  const [status, setStatus] = useState<string>('all');
  const [plan, setPlan] = useState<string>('all');
  const [paymentMethod, setPaymentMethod] = useState<string>('all');

  useEffect(() => {
    if (!roleLoading && !isAdmin) navigate('/dashboard');
  }, [roleLoading, isAdmin, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: rData, error: rErr }, { data: kData, error: kErr }] = await Promise.all([
        supabase.rpc('admin_list_payment_receipts', {
          p_start_date: startDate ? new Date(startDate).toISOString() : null,
          p_end_date: endDate ? new Date(endDate + 'T23:59:59').toISOString() : null,
          p_status: status === 'all' ? null : status,
          p_plan: plan === 'all' ? null : plan,
          p_payment_method: paymentMethod === 'all' ? null : paymentMethod,
          p_limit: 1000,
        }),
        supabase.rpc('admin_billing_kpis'),
      ]);
      if (rErr) throw rErr;
      if (kErr) throw kErr;
      setReceipts((rData as Receipt[]) || []);
      setKpis(kData as unknown as Kpis);
    } catch (e: any) {
      toast.error(e.message || (isFr ? 'Erreur de chargement' : 'Failed to load'));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, status, plan, paymentMethod, isFr]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const exportCsv = () => {
    if (!receipts.length) {
      toast.error(isFr ? 'Aucune donnée à exporter' : 'No data to export');
      return;
    }
    const headers = [
      'date', 'user_email', 'display_name', 'plan', 'amount', 'currency',
      'payment_method', 'billing_cycle', 'status', 'payment_token', 'refunded_at', 'refund_reason',
    ];
    const escape = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n;]/.test(s) ? `"${s}"` : s;
    };
    const rows = receipts.map((r) => [
      r.created_at,
      r.user_email,
      r.display_name,
      r.plan_name,
      r.amount,
      r.currency,
      r.payment_method,
      r.billing_cycle,
      r.status,
      r.payment_token,
      r.refunded_at,
      r.refund_reason,
    ].map(escape).join(','));
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const planOptions = useMemo(() => {
    const set = new Set(receipts.map((r) => r.plan_name).filter(Boolean));
    return Array.from(set);
  }, [receipts]);

  const methodOptions = useMemo(() => {
    const set = new Set(receipts.map((r) => r.payment_method).filter(Boolean) as string[]);
    return Array.from(set);
  }, [receipts]);

  if (roleLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!isAdmin) {
    return (
      <Card className="m-6"><CardContent className="p-8 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto mb-2 text-destructive" />
        {isFr ? "Accès réservé aux administrateurs" : "Admin only"}
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {isFr ? 'Facturation & remboursements' : 'Billing & refunds'}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isFr ? "Suivi des encaissements, abonnés et remboursements" : 'Payments, subscribers and refund tracking'}
        </p>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label={isFr ? 'MRR estimé' : 'Estimated MRR'}
          value={kpis ? formatAmount(Number(kpis.mrr_xof || 0), 'XOF', locale) : '—'}
        />
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          label={isFr ? 'Revenus du mois (XOF)' : 'Revenue this month (XOF)'}
          value={kpis ? formatAmount(Number(kpis.revenue_month_xof || 0), 'XOF', locale) : '—'}
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label={isFr ? 'Abonnés actifs' : 'Active subscribers'}
          value={kpis ? Object.entries(kpis.active_by_plan || {}).map(([k, v]) => `${k}: ${v}`).join(' · ') || '0' : '—'}
        />
        <KpiCard
          icon={<Percent className="h-4 w-4" />}
          label={isFr ? 'Taux de remboursement (90j)' : 'Refund rate (90d)'}
          value={kpis ? `${(Number(kpis.refund_rate_90d) || 0).toFixed(1)}%` : '—'}
          hint={kpis ? `${kpis.refunded_receipts_90d}/${kpis.total_receipts_90d}` : ''}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground">{isFr ? 'Du' : 'From'}</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{isFr ? 'Au' : 'To'}</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{isFr ? 'Statut' : 'Status'}</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isFr ? 'Tous' : 'All'}</SelectItem>
                <SelectItem value="confirmed">{isFr ? 'Confirmé' : 'Confirmed'}</SelectItem>
                <SelectItem value="pending">{isFr ? 'En attente' : 'Pending'}</SelectItem>
                <SelectItem value="refunded">{isFr ? 'Remboursé' : 'Refunded'}</SelectItem>
                <SelectItem value="failed">{isFr ? 'Échoué' : 'Failed'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{isFr ? 'Plan' : 'Plan'}</label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isFr ? 'Tous' : 'All'}</SelectItem>
                {['pro', 'premium', ...planOptions.filter((p) => p !== 'pro' && p !== 'premium')].map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{isFr ? 'Moyen' : 'Method'}</label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isFr ? 'Tous' : 'All'}</SelectItem>
                <SelectItem value="paystack">Paystack</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                {methodOptions
                  .filter((m) => !['paystack', 'stripe'].includes(m))
                  .map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading} className="flex-1">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {isFr ? 'Filtrer' : 'Filter'}
            </Button>
            <Button onClick={exportCsv} disabled={!receipts.length}>
              <Download className="h-4 w-4 mr-2" />CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">
          {isFr ? 'Reçus' : 'Receipts'} ({receipts.length})
        </CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : receipts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{isFr ? 'Aucun reçu trouvé' : 'No receipts found'}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isFr ? 'Date' : 'Date'}</TableHead>
                  <TableHead>{isFr ? 'Utilisateur' : 'User'}</TableHead>
                  <TableHead>{isFr ? 'Plan' : 'Plan'}</TableHead>
                  <TableHead className="text-right">{isFr ? 'Montant' : 'Amount'}</TableHead>
                  <TableHead>{isFr ? 'Devise' : 'Currency'}</TableHead>
                  <TableHead>{isFr ? 'Moyen' : 'Method'}</TableHead>
                  <TableHead>{isFr ? 'Cycle' : 'Cycle'}</TableHead>
                  <TableHead>{isFr ? 'Statut' : 'Status'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((r) => {
                  const sb = STATUS_BADGE[r.status] || STATUS_BADGE.pending;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(r.created_at), 'dd MMM yyyy HH:mm', { locale: dl })}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        <div className="font-medium text-sm">{r.display_name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{r.user_email || '—'}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{r.plan_name}</Badge></TableCell>
                      <TableCell className="text-right font-mono">
                        {formatAmount(Number(r.amount), r.currency, locale)}
                      </TableCell>
                      <TableCell className="text-xs">{r.currency}</TableCell>
                      <TableCell className="text-xs">{r.payment_method || '—'}</TableCell>
                      <TableCell className="text-xs">{r.billing_cycle || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={sb.variant}>{isFr ? sb.fr : sb.en}</Badge>
                        {r.refunded_at && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {format(new Date(r.refunded_at), 'dd MMM yyyy', { locale: dl })}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const KpiCard = ({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">{icon}{label}</div>
      <div className="text-xl font-bold tracking-tight">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </CardContent>
  </Card>
);

export default AdminBillingPage;