import { useState, useMemo } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { useReceipts } from '@/hooks/useDashboardData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Receipt, Inbox, Printer, Download, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { exportToCSV, exportToExcel } from '@/lib/export';
import { toast } from 'sonner';

const printReceipt = (receipt: any, locale: string) => {
  const dateStr = new Date(receipt.created_at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const amountStr = Number(receipt.amount).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: receipt.currency });
  const w = window.open('', '_blank', 'width=400,height=500');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>body{font-family:system-ui;padding:2rem;max-width:350px;margin:auto}h1{font-size:1.2rem;text-align:center}table{width:100%;border-collapse:collapse;margin:1rem 0}td{padding:.4rem 0;border-bottom:1px solid #eee}td:last-child{text-align:right;font-weight:600}.footer{text-align:center;font-size:.75rem;color:#888;margin-top:2rem}</style></head><body>
    <h1>Budget Planner</h1>
    <p style="text-align:center;color:#666;font-size:.85rem">${locale === 'fr' ? 'Reçu de paiement' : 'Payment Receipt'}</p>
    <table>
      <tr><td>${locale === 'fr' ? 'Plan' : 'Plan'}</td><td>${receipt.plan_name}</td></tr>
      <tr><td>${locale === 'fr' ? 'Montant' : 'Amount'}</td><td>${amountStr}</td></tr>
      <tr><td>Date</td><td>${dateStr}</td></tr>
      <tr><td>${locale === 'fr' ? 'Statut' : 'Status'}</td><td>${receipt.status}</td></tr>
      ${receipt.payment_token ? `<tr><td>Ref</td><td style="font-size:.75rem">${receipt.payment_token}</td></tr>` : ''}
    </table>
    <p class="footer">© ${new Date().getFullYear()} Budget Planner</p>
  </body></html>`);
  w.document.close();
  w.print();
};

const ReceiptsPage = () => {
  const { locale } = useLanguage();
  const t = dashT[locale];
  const { data: receipts = [], isLoading: loading } = useReceipts();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const filtered = useMemo(() => {
    let result = receipts as any[];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.plan_name.toLowerCase().includes(q) || r.payment_token?.toLowerCase().includes(q));
    }
    if (statusFilter) result = result.filter(r => r.status === statusFilter);
    return result;
  }, [receipts, searchQuery, statusFilter]);

  const statuses = useMemo(() => [...new Set((receipts as any[]).map(r => r.status))], [receipts]);

  const handleExportCSV = () => {
    const rows = filtered.map((r: any) => ({
      Plan: r.plan_name,
      Amount: r.amount,
      Currency: r.currency,
      Status: r.status,
      Date: new Date(r.created_at).toISOString().split('T')[0],
      Ref: r.payment_token || '',
    }));
    if (!exportToCSV(rows, 'receipts')) toast.info(t.noReceipts);
  };

  const handleExportExcel = () => {
    const rows = filtered.map((r: any) => ({
      Plan: r.plan_name,
      Amount: r.amount,
      Currency: r.currency,
      Status: r.status,
      Date: new Date(r.created_at).toISOString().split('T')[0],
      Ref: r.payment_token || '',
    }));
    if (!exportToExcel(rows, 'receipts')) toast.info(t.noReceipts);
  };

  if (loading) return <div className="space-y-6"><Skeleton className="h-8 w-40" />{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold font-display">{t.receipts}</h2>
        {receipts.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="rounded-xl"><Download className="w-4 h-4 mr-1" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="rounded-xl"><Download className="w-4 h-4 mr-1" /> Excel</Button>
          </div>
        )}
      </div>

      {/* Filters */}
      {receipts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={locale === 'fr' ? 'Rechercher par plan ou ref...' : 'Search by plan or ref...'}
              className="pl-9 pr-8 rounded-xl h-10"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border
                ${!statusFilter ? 'bg-primary text-primary-foreground border-primary' : 'bg-background/60 text-muted-foreground border-border/40 hover:bg-background/80'}`}
            >
              {locale === 'fr' ? 'Tous' : 'All'}
            </button>
            {statuses.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border capitalize
                  ${statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background/60 text-muted-foreground border-border/40 hover:bg-background/80'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="border-none shadow-[var(--shadow-card)]"><CardContent className="py-16 text-center"><Inbox className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" /><p className="text-lg font-medium text-muted-foreground">{t.noReceipts}</p></CardContent></Card>
      ) : (
        <Card className="border-none shadow-[var(--shadow-card)]">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filtered.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Receipt className="w-5 h-5 text-primary" />
                    <div><p className="text-sm font-medium">{r.plan_name}</p><p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{Number(r.amount).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: r.currency })}</span>
                    <Badge variant={r.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">{r.status}</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => printReceipt(r, locale)}>
                      <Printer className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReceiptsPage;