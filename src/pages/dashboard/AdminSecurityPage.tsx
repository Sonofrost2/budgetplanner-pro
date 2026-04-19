// Superadmin security board: shows IP addresses linked to multiple accounts
// (multi-account abuse signal) sourced from device_fingerprints.

import { useEffect, useState, useCallback } from 'react';
import { useRole } from '@/hooks/useRole';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert, AlertTriangle, RefreshCw } from 'lucide-react';
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

const AdminSecurityPage = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const isFr = locale === 'fr';
  const [items, setItems] = useState<SuspiciousIp[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => { load(); }, [load]);

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
    </div>
  );
};

export default AdminSecurityPage;
