import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';

export const DataExportCard = () => {
  const { locale } = useLanguage();
  const fr = locale === 'fr';
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-user-data`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);

      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `budgetplanner-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);

      toast.success(fr ? 'Export téléchargé' : 'Export downloaded');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          {fr ? 'Exporter mes données' : 'Export my data'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {fr
            ? 'Téléchargez l\'intégralité de vos données au format JSON (RGPD).'
            : 'Download all your data as JSON (GDPR compliance).'}
        </p>
      </CardHeader>
      <CardContent>
        <Button onClick={handleExport} disabled={loading} className="w-full sm:w-auto">
          <Download className="w-4 h-4 mr-2" />
          {loading ? (fr ? 'Préparation...' : 'Preparing...') : (fr ? 'Télécharger l\'export JSON' : 'Download JSON export')}
        </Button>
      </CardContent>
    </Card>
  );
};
