// Superadmin security board: shows IP addresses linked to multiple accounts
// (multi-account abuse signal) sourced from device_fingerprints.

import { useEffect, useState, useCallback } from 'react';
import { useRole } from '@/hooks/useRole';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert, AlertTriangle, RefreshCw, Globe, Wifi } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

type SuspiciousIp = {
  ip_address: string;
  account_count: number;
  user_ids: string[];
  emails: string[];
  first_seen: string;
  last_seen: string;
};

type SecuritySignal = {
  id: string;
  user_id: string | null;
  event_type: string;
  ip_address: string | null;
  detected_country: string | null;
  declared_country: string | null;
  risk_score: number;
  is_vpn: boolean;
  is_proxy: boolean;
  is_tor: boolean;
  is_hosting: boolean;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const AdminSecurityPage = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const isFr = locale === 'fr';
  const [items, setItems] = useState<SuspiciousIp[]>([]);
  const [loading, setLoading] = useState(false);
  const [signals, setSignals] = useState<SecuritySignal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-user-action', {
        body: { action: 'suspicious_ips' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setItems(data.items || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const loadSignals = useCallback(async () => {
    if (!isAdmin) return;
    setSignalsLoading(true);
    const { data, error } = await supabase
      .from('security_signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) toast.error(error.message);
    else setSignals((data as SecuritySignal[]) || []);
    setSignalsLoading(false);
  }, [isAdmin]);

  useEffect(() => { load(); loadSignals(); }, [load, loadSignals]);

  if (roleLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!isAdmin) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardContent className="p-8 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-destructive" />
          <h2 className="text-lg font-semibold">{isFr ? 'Accès refusé' : 'Access denied'}</h2>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden border-destructive/20 bg-gradient-to-br from-destructive/[0.06] to-transparent">
          <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-destructive/15 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h1 className="text-lg font-bold font-display">
                  {isFr ? 'Signaux de sécurité' : 'Security signals'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'IPs liées à plusieurs comptes (potentiel abus multi-comptes).' : 'IPs tied to multiple accounts (potential multi-account abuse).'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/admin/users')}>
                {isFr ? 'Console users' : 'Users console'}
              </Button>
              <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-40" />
            {isFr ? 'Aucun signal détecté. Tout est calme.' : 'No signals detected. All clear.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={item.ip_address} className="border-amber-500/20">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-mono font-semibold">{String(item.ip_address)}</code>
                      <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/20 gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {item.account_count} {isFr ? 'comptes' : 'accounts'}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {isFr ? 'Premier vu' : 'First seen'} {format(new Date(item.first_seen), 'dd MMM HH:mm', { locale: isFr ? fr : enUS })}
                      {' · '}
                      {isFr ? 'Dernier' : 'Last'} {format(new Date(item.last_seen), 'dd MMM HH:mm', { locale: isFr ? fr : enUS })}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.emails.map((email, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] font-normal">
                          {email}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Security signals (VPN / proxy / Tor / country mismatch) */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">{isFr ? 'Signaux VPN/Proxy/Géo' : 'VPN/Proxy/Geo signals'}</h2>
              <Badge variant="outline" className="text-[10px]">{signals.length}</Badge>
            </div>
            <Button size="sm" variant="ghost" onClick={loadSignals} disabled={signalsLoading}>
              {signalsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </Button>
          </div>

          {signals.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              {isFr ? 'Aucun signal pour le moment.' : 'No signals yet.'}
            </p>
          ) : (
            <div className="space-y-2">
              {signals.map((s) => {
                const high = s.risk_score >= 70;
                const med = s.risk_score >= 40;
                return (
                  <div key={s.id} className={`rounded-lg border p-3 text-xs space-y-1.5 ${high ? 'border-destructive/40 bg-destructive/[0.04]' : med ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-border/40'}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={high ? 'border-destructive/40 text-destructive' : ''}>
                          {s.event_type}
                        </Badge>
                        <Badge variant="outline" className="font-mono">{isFr ? 'Risque' : 'Risk'} {s.risk_score}/100</Badge>
                        {s.is_vpn && <Badge variant="outline" className="text-amber-600 border-amber-500/40"><Wifi className="w-2.5 h-2.5 mr-0.5" />VPN</Badge>}
                        {s.is_tor && <Badge variant="outline" className="text-destructive border-destructive/40">Tor</Badge>}
                        {s.is_proxy && <Badge variant="outline">Proxy</Badge>}
                        {s.is_hosting && <Badge variant="outline">Hosting</Badge>}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(s.created_at), 'dd MMM HH:mm', { locale: isFr ? fr : enUS })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      {s.ip_address && <code className="font-mono">{String(s.ip_address)}</code>}
                      {s.detected_country && <span>📍 {s.detected_country}</span>}
                      {s.declared_country && <span>🏷 {s.declared_country}</span>}
                      {s.user_id && <span className="truncate max-w-[180px]">user: {s.user_id.slice(0, 8)}…</span>}
                    </div>
                    {s.metadata?.org && (
                      <div className="text-[10px] text-muted-foreground/80 truncate">org: {String(s.metadata.org)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSecurityPage;
