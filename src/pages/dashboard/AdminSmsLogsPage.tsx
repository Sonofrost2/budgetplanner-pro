import { useEffect, useMemo, useState } from 'react';
import { useRole } from '@/hooks/useRole';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HeroHeaderShell } from '@/components/dashboard/HeroHeaderShell';
import { History, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { SMS_TEMPLATES } from '@/lib/smsTemplates';

type LogRow = {
  id: string;
  sent_by: string | null;
  recipient: string;
  template_id: string | null;
  body: string;
  twilio_sid: string | null;
  status: string;
  error_message: string | null;
  error_code: string | null;
  created_at: string;
};

const PAGE_SIZE = 50;

const AdminSmsLogsPage = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const { locale } = useLanguage();
  const isFr = locale === 'fr';

  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'queued' | 'failed' | 'delivered'>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sms_send_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data as LogRow[]) || []);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const templateLabel = (id: string | null): string => {
    if (!id) return isFr ? '— libre —' : '— free —';
    const t = SMS_TEMPLATES.find(x => x.id === id);
    if (!t) return id;
    return isFr ? t.label_fr : t.label_en;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== 'all' && (r.status || '').toLowerCase() !== statusFilter) return false;
      if (templateFilter !== 'all' && (r.template_id || '__none__') !== templateFilter) return false;
      if (q) {
        const hay = `${r.recipient} ${r.body} ${r.twilio_sid || ''} ${r.error_message || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, templateFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const failed = rows.filter(r => (r.status || '').toLowerCase() === 'failed').length;
    const sent = total - failed;
    return { total, failed, sent };
  }, [rows]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('sms_send_logs').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setRows(prev => prev.filter(r => r.id !== id));
    toast.success(isFr ? 'Entrée supprimée' : 'Entry removed');
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(isFr ? 'fr-FR' : 'en-US', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  if (roleLoading) return <div className="p-6 text-sm text-muted-foreground">{isFr ? 'Chargement…' : 'Loading…'}</div>;
  if (!isAdmin) {
    return (
      <Card className="rounded-2xl glass border-destructive/30 max-w-xl mx-auto mt-8">
        <CardContent className="p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{isFr ? 'Accès réservé aux administrateurs' : 'Admins only'}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isFr ? 'Cette page nécessite le rôle administrateur.' : 'This page requires the admin role.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <HeroHeaderShell topBlobClassName="bg-primary/25" bottomBlobClassName="bg-accent/15">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-primary)' }}>
            <History className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Admin</span>
            <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">{isFr ? 'Historique des SMS' : 'SMS history'}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isFr ? 'Derniers envois Twilio (destinataires, modèles, statuts)' : 'Recent Twilio sends (recipients, templates, statuses)'}
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading} className="rounded-xl">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            {isFr ? 'Rafraîchir' : 'Refresh'}
          </Button>
        </div>
      </HeroHeaderShell>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="rounded-2xl glass border-border/50">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Total (50 derniers)' : 'Total (last 50)'}</p>
            <p className="text-2xl font-bold font-display mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl glass border-border/50">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{isFr ? 'Envoyés' : 'Sent'}</p>
            <p className="text-2xl font-bold font-display mt-1">{stats.sent}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl glass border-border/50">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-destructive">{isFr ? 'Échecs' : 'Failed'}</p>
            <p className="text-2xl font-bold font-display mt-1">{stats.failed}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl glass border-border/50">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isFr ? 'Numéro, message, SID…' : 'Number, message, SID…'}
              className="rounded-xl pl-9 h-9 text-xs"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="rounded-xl h-9 text-xs w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isFr ? 'Tous statuts' : 'All statuses'}</SelectItem>
              <SelectItem value="sent">sent</SelectItem>
              <SelectItem value="queued">queued</SelectItem>
              <SelectItem value="delivered">delivered</SelectItem>
              <SelectItem value="failed">failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={templateFilter} onValueChange={setTemplateFilter}>
            <SelectTrigger className="rounded-xl h-9 text-xs w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isFr ? 'Tous modèles' : 'All templates'}</SelectItem>
              <SelectItem value="__none__">{isFr ? '— libre —' : '— free —'}</SelectItem>
              {SMS_TEMPLATES.map(t => (
                <SelectItem key={t.id} value={t.id}>{isFr ? t.label_fr : t.label_en}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Logs table */}
      <Card className="rounded-2xl glass border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider">{isFr ? 'Date' : 'Date'}</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">{isFr ? 'Destinataire' : 'Recipient'}</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">{isFr ? 'Modèle' : 'Template'}</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">{isFr ? 'Statut' : 'Status'}</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">SID</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">{isFr ? 'Chargement…' : 'Loading…'}</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                  {isFr ? 'Aucun envoi trouvé' : 'No sends found'}
                </TableCell></TableRow>
              )}
              {!loading && filtered.map(r => {
                const failed = (r.status || '').toLowerCase() === 'failed';
                const isOpen = expandedId === r.id;
                return (
                  <>
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => setExpandedId(isOpen ? null : r.id)}
                    >
                      <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.created_at)}</TableCell>
                      <TableCell className="text-xs font-mono">{r.recipient}</TableCell>
                      <TableCell className="text-xs">
                        {r.template_id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span>{templateLabel(r.template_id)}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">{isFr ? '— libre —' : '— free —'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {failed ? (
                          <Badge variant="outline" className="rounded-full text-[10px] border-destructive/30 text-destructive">
                            <XCircle className="w-3 h-3 mr-1" />{r.status}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3 mr-1" />{r.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-[11px] font-mono text-muted-foreground truncate max-w-[140px]">{r.twilio_sid || '—'}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={6} className="py-3">
                          <div className="space-y-2 text-xs">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isFr ? 'Message' : 'Message'}</span>
                              <p className="mt-1 p-2 rounded-lg bg-background/60 border border-border/40 whitespace-pre-wrap break-words">{r.body}</p>
                            </div>
                            {r.error_message && (
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-destructive">{isFr ? 'Erreur' : 'Error'}</span>
                                <p className="mt-1 p-2 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive break-words">
                                  {r.error_message} {r.error_code ? `(code ${r.error_code})` : ''}
                                </p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSmsLogsPage;