import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, FileJson } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';
import * as XLSX from 'xlsx';
import { useSubscription } from '@/hooks/useSubscription';

export const DataExportCard = () => {
  const { locale } = useLanguage();
  const fr = locale === 'fr';
  const { canExportAdvanced } = useSubscription();
  const [loadingJson, setLoadingJson] = useState(false);
  const [loadingXlsx, setLoadingXlsx] = useState(false);

  const fetchExport = async (): Promise<Record<string, any>> => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error(fr ? 'Non authentifié' : 'Not authenticated');
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-user-data`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    return await res.json();
  };

  const handleExportJson = async () => {
    setLoadingJson(true);
    try {
      const data = await fetchExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `budgetplanner-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      toast.success(fr ? 'Export JSON téléchargé' : 'JSON export downloaded');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoadingJson(false);
    }
  };

  const handleExportExcel = async () => {
    if (!canExportAdvanced) {
      toast.error(fr ? 'Export Excel réservé au plan Premium' : 'Excel export is Premium only');
      return;
    }
    setLoadingXlsx(true);
    try {
      const data = await fetchExport();
      const wb = XLSX.utils.book_new();
      // Meta sheet
      const meta = (data._meta as Record<string, any>) || {};
      const metaRows = [
        [fr ? 'Export BudgetPlanner Pro' : 'BudgetPlanner Pro export'],
        [],
        [fr ? 'Exporté le' : 'Exported at', meta.exported_at || new Date().toISOString()],
        [fr ? 'Utilisateur' : 'User', meta.user_id || ''],
        ['Email', meta.email || ''],
        ['Version', meta.version ?? 1],
      ];
      const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
      wsMeta['!cols'] = [{ wch: 22 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, wsMeta, fr ? 'Résumé' : 'Summary');

      // One sheet per table
      let sheetCount = 0;
      for (const [key, value] of Object.entries(data)) {
        if (key === '_meta') continue;
        const rows = Array.isArray(value) ? value : [];
        if (rows.length === 0) continue;
        const ws = XLSX.utils.json_to_sheet(rows);
        // Excel sheet names: max 31 chars, no special chars
        const safeName = key.replace(/[\\/?*[\]:]/g, '_').slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, safeName);
        sheetCount++;
      }

      if (sheetCount === 0) {
        toast.info(fr ? 'Aucune donnée à exporter' : 'No data to export');
        return;
      }

      XLSX.writeFile(wb, `budgetplanner-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(fr ? 'Export Excel téléchargé' : 'Excel export downloaded');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoadingXlsx(false);
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
            ? 'Téléchargez l\'intégralité de vos données au format JSON (RGPD) ou Excel (une feuille par table).'
            : 'Download all your data as JSON (GDPR) or Excel (one sheet per table).'}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row gap-2">
        <Button onClick={handleExportJson} disabled={loadingJson || loadingXlsx} variant="outline" className="w-full sm:w-auto">
          <FileJson className="w-4 h-4 mr-2" />
          {loadingJson ? (fr ? 'Préparation...' : 'Preparing...') : (fr ? 'Export JSON' : 'JSON export')}
        </Button>
        <Button
          onClick={handleExportExcel}
          disabled={loadingJson || loadingXlsx || !canExportAdvanced}
          className="w-full sm:w-auto"
          title={!canExportAdvanced ? (fr ? 'Premium requis' : 'Premium required') : undefined}
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          {loadingXlsx ? (fr ? 'Préparation...' : 'Preparing...') : (fr ? 'Export Excel' : 'Excel export')}
          {!canExportAdvanced && <span className="ml-2 text-xs opacity-80">Premium</span>}
        </Button>
      </CardContent>
    </Card>
  );
};
