import { useState, useMemo } from 'react';
import WealthAnalysisTab from '@/components/dashboard/wealth/WealthAnalysisTab';
import { WealthHeroHeader } from '@/components/dashboard/wealth/WealthHeroHeader';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResponsiveFormDialog } from '@/components/ui/responsive-form-dialog';
import { InputField } from '@/components/ui/input-field';
import { FormSection } from '@/components/ui/form-section';
import { FilterToolbar } from '@/components/dashboard/FilterToolbar';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';
import {
  Building2, Car, TrendingUp, Wallet, Plus, Pencil, Trash2, Sparkles,
  MapPin, Calendar, ArrowUpRight, ArrowDownRight, History, Loader2,
  Gem, Package, BarChart3, Eye, FileDown, FileSpreadsheet
} from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { WealthProjectionChart } from '@/components/dashboard/wealth/WealthProjectionChart';
import { exportWealthPDF, exportWealthExcel } from '@/lib/wealthExport';

const ASSET_TYPES = [
  { value: 'real_estate', label_fr: 'Immobilier', label_en: 'Real Estate', icon: '🏠', lucide: Building2, color: 'hsl(var(--primary))' },
  { value: 'vehicle', label_fr: 'Véhicule', label_en: 'Vehicle', icon: '🚗', lucide: Car, color: 'hsl(var(--secondary))' },
  { value: 'financial', label_fr: 'Investissement financier', label_en: 'Financial Investment', icon: '📈', lucide: TrendingUp, color: 'hsl(var(--accent))' },
  { value: 'savings', label_fr: 'Épargne & Comptes', label_en: 'Savings & Accounts', icon: '💰', lucide: Wallet, color: 'hsl(var(--chart-4, 280 65% 60%))' },
  { value: 'jewelry', label_fr: 'Bijoux & Objets de valeur', label_en: 'Jewelry & Valuables', icon: '💎', lucide: Gem, color: 'hsl(var(--chart-5, 340 75% 55%))' },
  { value: 'other', label_fr: 'Autre', label_en: 'Other', icon: '📦', lucide: Package, color: 'hsl(var(--muted-foreground))' },
];

const CATEGORIES: Record<string, { label_fr: string; label_en: string }[]> = {
  real_estate: [
    { label_fr: 'Terrain', label_en: 'Land' },
    { label_fr: 'Maison', label_en: 'House' },
    { label_fr: 'Appartement', label_en: 'Apartment' },
    { label_fr: 'Immeuble', label_en: 'Building' },
    { label_fr: 'Local commercial', label_en: 'Commercial Space' },
  ],
  vehicle: [
    { label_fr: 'Voiture', label_en: 'Car' },
    { label_fr: 'Moto', label_en: 'Motorcycle' },
    { label_fr: 'Camion', label_en: 'Truck' },
  ],
  financial: [
    { label_fr: 'Actions', label_en: 'Stocks' },
    { label_fr: 'Obligations', label_en: 'Bonds' },
    { label_fr: 'Parts sociales', label_en: 'Shares' },
    { label_fr: 'Crypto', label_en: 'Crypto' },
    { label_fr: 'Assurance vie', label_en: 'Life Insurance' },
    { label_fr: 'Fonds commun', label_en: 'Mutual Fund' },
  ],
  savings: [
    { label_fr: 'Compte épargne', label_en: 'Savings Account' },
    { label_fr: 'CAG', label_en: 'CAG' },
    { label_fr: 'Dépôt à terme', label_en: 'Term Deposit' },
  ],
  jewelry: [
    { label_fr: 'Or', label_en: 'Gold' },
    { label_fr: 'Bijoux', label_en: 'Jewelry' },
    { label_fr: 'Œuvre d\'art', label_en: 'Artwork' },
  ],
  other: [
    { label_fr: 'Équipement', label_en: 'Equipment' },
    { label_fr: 'Autre', label_en: 'Other' },
  ],
};

const ICONS = ['🏠', '🏢', '🏗️', '🏘️', '🚗', '🏍️', '🚛', '📈', '💹', '🏦', '💰', '💎', '🪙', '📦', '🎨', '⚡', '🌍'];

interface Asset {
  id: string;
  name: string;
  asset_type: string;
  category: string;
  acquisition_date: string | null;
  acquisition_cost: number;
  current_value: number;
  currency: string;
  location: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  icon: string;
  created_at: string;
}

interface Valuation {
  id: string;
  asset_id: string;
  valued_at: string;
  value: number;
  notes: string | null;
  source: string;
}

const WealthPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const isFr = locale === 'fr';
  const queryClient = useQueryClient();
  const fmt = (n: number) => fmtCurrency(n, locale);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [valuationDialog, setValuationDialog] = useState<string | null>(null);
  const [valuationValue, setValuationValue] = useState('');
  const [valuationNotes, setValuationNotes] = useState('');
  const [valuationDate, setValuationDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [historyAssetId, setHistoryAssetId] = useState<string | null>(null);
  const [aiValuing, setAiValuing] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: '', asset_type: 'real_estate', category: '', acquisition_date: '',
    acquisition_cost: '', current_value: '', location: '', notes: '', icon: '🏠',
    metadata: '{}',
  });

  // ─── Queries ───
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('assets').select('*')
        .eq('user_id', user!.id).order('current_value', { ascending: false });
      if (error) throw error;
      return data as Asset[];
    },
    enabled: !!user,
  });

  const { data: allValuations = [] } = useQuery({
    queryKey: ['asset-valuations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('asset_valuations').select('*')
        .eq('user_id', user!.id).order('valued_at', { ascending: true });
      if (error) throw error;
      return data as Valuation[];
    },
    enabled: !!user,
  });

  const { data: debts = [] } = useQuery({
    queryKey: ['debts-wealth', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('debts').select('creditor_name, total_amount, paid_amount')
        .eq('user_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: savingsGoals = [] } = useQuery({
    queryKey: ['savings-goals-wealth-live', user?.id],
    queryFn: async () => {
      // Fetch only LIVE goals — completed/archived/paused must not inflate net worth.
      const { data } = await supabase
        .from('savings_goals')
        .select('name, current_amount, target_amount, icon, status, paused_at, deleted_at')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .is('paused_at', null)
        .eq('status', 'active');
      return data || [];
    },
    enabled: !!user,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['assets', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['asset-valuations', user?.id] });
  };

  // ─── Computed ───
  const totalAssets = useMemo(() => assets.reduce((s, a) => s + Number(a.current_value), 0), [assets]);
  const totalSavings = useMemo(() => savingsGoals.reduce((s, g) => s + Number(g.current_amount), 0), [savingsGoals]);
  const totalDebt = useMemo(() => debts.reduce((s, d) => s + (Number(d.total_amount) - Number(d.paid_amount || 0)), 0), [debts]);
  const netWorth = totalAssets + totalSavings - totalDebt;
  const totalAcquisition = useMemo(() => assets.reduce((s, a) => s + Number(a.acquisition_cost || 0), 0), [assets]);
  const totalGainLoss = totalAssets - totalAcquisition;

  // Projection data for export
  const projectionData = useMemo(() => {
    const defaults: Record<string, number> = { real_estate: 0.05, vehicle: -0.10, financial: 0.07, savings: 0.03, jewelry: 0.03, other: 0.02 };
    const currentYear = new Date().getFullYear();
    const data: { year: string; optimistic: number; base: number; pessimistic: number }[] = [];
    for (let y = 0; y <= 5; y++) {
      if (y === 0) { data.push({ year: String(currentYear), optimistic: netWorth, base: netWorth, pessimistic: netWorth }); continue; }
      let baseAssets = 0;
      assets.forEach(a => { baseAssets += Number(a.current_value) * Math.pow(1 + (defaults[a.asset_type] ?? 0.03), y); });
      const baseSavings = totalSavings * Math.pow(1.03, y);
      const baseDebt = totalDebt * Math.pow(0.85, y);
      const base = baseAssets + baseSavings - baseDebt;
      data.push({ year: String(currentYear + y), optimistic: Math.round(base * (1 + 0.02 * y)), base: Math.round(base), pessimistic: Math.round(base * (1 - 0.02 * y)) });
    }
    return data;
  }, [assets, netWorth, totalSavings, totalDebt]);

  const handleExport = (type: 'pdf' | 'excel') => {
    const exportData = { assets: assets as any, savingsGoals, debts: debts as any, netWorth, totalAssets, totalSavings, totalDebt, totalGainLoss, projections: projectionData, pieData, isFr, fmt };
    type === 'pdf' ? exportWealthPDF(exportData) : exportWealthExcel(exportData);
  };

  const filteredAssets = useMemo(() => {
    let result = [...assets];
    if (filterType !== 'all') result = result.filter(a => a.asset_type === filterType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q) || a.location?.toLowerCase().includes(q));
    }
    return result;
  }, [assets, filterType, searchQuery]);

  // Pie chart data
  const pieData = useMemo(() => {
    const byType: Record<string, number> = {};
    assets.forEach(a => { byType[a.asset_type] = (byType[a.asset_type] || 0) + Number(a.current_value); });
    if (totalSavings > 0) byType['savings'] = (byType['savings'] || 0) + totalSavings;
    return Object.entries(byType).map(([type, value]) => ({
      name: ASSET_TYPES.find(t => t.value === type)?.[isFr ? 'label_fr' : 'label_en'] || type,
      value,
      color: ASSET_TYPES.find(t => t.value === type)?.color || 'hsl(var(--muted))',
    })).filter(d => d.value > 0);
  }, [assets, totalSavings, isFr]);

  // Net worth evolution
  const netWorthEvolution = useMemo(() => {
    if (allValuations.length === 0) return [];
    const byDate: Record<string, number> = {};
    allValuations.forEach(v => {
      const d = v.valued_at;
      byDate[d] = (byDate[d] || 0) + Number(v.value);
    });
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({
      date: format(new Date(date), 'MMM yy', { locale: isFr ? fr : enUS }),
      value: total,
    }));
  }, [allValuations, isFr]);

  // Valuations for a specific asset
  const assetValuations = useMemo(() => {
    if (!historyAssetId) return [];
    return allValuations.filter(v => v.asset_id === historyAssetId);
  }, [allValuations, historyAssetId]);

  // ─── Handlers ───
  const resetForm = () => setForm({
    name: '', asset_type: 'real_estate', category: '', acquisition_date: '',
    acquisition_cost: '', current_value: '', location: '', notes: '', icon: '🏠', metadata: '{}',
  });

  const openEdit = (asset: Asset) => {
    setEditId(asset.id);
    setFormErrors({});
    setForm({
      name: asset.name, asset_type: asset.asset_type, category: asset.category,
      acquisition_date: asset.acquisition_date || '', acquisition_cost: String(asset.acquisition_cost),
      current_value: String(asset.current_value), location: asset.location || '',
      notes: asset.notes || '', icon: asset.icon, metadata: JSON.stringify(asset.metadata),
    });
    setDialogOpen(true);
  };

  const validateAssetForm = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = isFr ? 'Le nom est requis' : 'Name is required';
    if (!form.current_value || Number(form.current_value) <= 0) errs.current_value = isFr ? 'La valeur doit être supérieure à 0' : 'Value must be greater than 0';
    if (form.acquisition_cost && Number(form.acquisition_cost) < 0) errs.acquisition_cost = isFr ? 'Le coût ne peut pas être négatif' : 'Cost cannot be negative';
    if (form.acquisition_date && new Date(form.acquisition_date) > new Date()) errs.acquisition_date = isFr ? 'La date ne peut pas être dans le futur' : 'Date cannot be in the future';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!user || !validateAssetForm()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        asset_type: form.asset_type,
        category: form.category || form.asset_type,
        acquisition_date: form.acquisition_date || null,
        acquisition_cost: Number(form.acquisition_cost) || 0,
        current_value: Number(form.current_value),
        location: form.location || null,
        notes: form.notes || null,
        icon: form.icon,
        metadata: JSON.parse(form.metadata || '{}'),
      };

      if (editId) {
        const { error } = await supabase.from('assets').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('assets').insert({ ...payload, user_id: user.id });
        if (error) throw error;
        // Auto-create initial valuation
        const { data: newAsset } = await supabase.from('assets').select('id').eq('user_id', user.id)
          .eq('name', payload.name).order('created_at', { ascending: false }).limit(1).single();
        if (newAsset) {
          await supabase.from('asset_valuations').insert({
            asset_id: newAsset.id, user_id: user.id,
            value: payload.current_value, valued_at: payload.acquisition_date || new Date().toISOString().split('T')[0],
            source: 'manual', notes: isFr ? 'Valeur initiale' : 'Initial value',
          });
        }
      }

      setDialogOpen(false);
      setEditId(null);
      resetForm();
      invalidate();
      toast.success(t.saved);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('assets').delete().eq('id', deleteId);
    setDeleteId(null);
    invalidate();
    toast.success(t.delete);
  };

  const handleAddValuation = async () => {
    if (!valuationDialog || !user || Number(valuationValue) <= 0) return;
    if (new Date(valuationDate) > new Date()) {
      toast.error(isFr ? 'La date ne peut pas être dans le futur' : 'Date cannot be in the future');
      return;
    }
    setSaving(true);
    try {
      await supabase.from('asset_valuations').insert({
        asset_id: valuationDialog, user_id: user.id,
        value: Number(valuationValue), valued_at: valuationDate,
        notes: valuationNotes || null, source: 'manual',
      });
      await supabase.from('assets').update({ current_value: Number(valuationValue) }).eq('id', valuationDialog);
      setValuationDialog(null);
      setValuationValue('');
      setValuationNotes('');
      invalidate();
      toast.success(isFr ? 'Valorisation enregistrée' : 'Valuation recorded');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAIValuation = async (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    setAiValuing(true);
    try {
      const vals = allValuations.filter(v => v.asset_id === assetId);
      const { data, error } = await supabase.functions.invoke('ai-wealth-valuation', {
        body: {
          asset: { name: asset.name, type: asset.asset_type, category: asset.category, location: asset.location, acquisition_cost: asset.acquisition_cost, current_value: asset.current_value, acquisition_date: asset.acquisition_date },
          valuations: vals.map(v => ({ date: v.valued_at, value: v.value })),
          locale,
        },
      });
      if (error) throw error;
      if (data?.suggested_value) {
        setValuationDialog(assetId);
        setValuationValue(String(data.suggested_value));
        setValuationNotes(data.reasoning || (isFr ? 'Suggestion IA' : 'AI suggestion'));
        toast.success(isFr ? `IA suggère : ${fmt(data.suggested_value)}` : `AI suggests: ${fmt(data.suggested_value)}`);
      }
    } catch (e: any) {
      toast.error(e.message || 'AI error');
    } finally {
      setAiValuing(false);
    }
  };

  const typeLabel = (type: string) => ASSET_TYPES.find(t => t.value === type)?.[isFr ? 'label_fr' : 'label_en'] || type;
  const typeIcon = (type: string) => ASSET_TYPES.find(t => t.value === type)?.icon || '📦';

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-40 rounded-2xl" /><div className="grid grid-cols-3 gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Hero header — glass, Coach Financier */}
      <WealthHeroHeader
        isFr={isFr}
        fmt={fmt}
        netWorth={netWorth}
        totalAssets={totalAssets}
        totalSavings={totalSavings}
        totalDebt={totalDebt}
        totalGainLoss={totalGainLoss}
        assetsCount={assets.length}
        onAddAsset={() => { resetForm(); setEditId(null); setDialogOpen(true); }}
        onExportPDF={() => handleExport('pdf')}
        onExportExcel={() => handleExport('excel')}
      />

      {/* KPI Cards */}
      <div className="space-y-3">

        {/* Sub-cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: isFr ? 'Actifs enregistrés' : 'Registered Assets', value: assets.length, icon: Package, suffix: '' },
            { label: isFr ? 'Épargne totale' : 'Total Savings', value: totalSavings, icon: Wallet, isCurrency: true },
            { label: isFr ? 'Valorisations' : 'Valuations', value: allValuations.length, icon: History, suffix: '' },
          ].map((card, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }} className="glass rounded-2xl p-3 sm:p-4">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <card.icon className="w-4 h-4 text-primary" />
              </div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{card.label}</p>
              <p className="text-sm sm:text-base font-extrabold tabular-nums truncate">
                {card.isCurrency ? fmt(card.value) : card.value}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex overflow-x-auto rounded-2xl bg-muted/50 p-1">
          <TabsTrigger value="overview" className="flex-1 rounded-xl text-xs">{isFr ? 'Vue d\'ensemble' : 'Overview'}</TabsTrigger>
          <TabsTrigger value="assets" className="flex-1 rounded-xl text-xs">{isFr ? 'Mes actifs' : 'My Assets'}</TabsTrigger>
          <TabsTrigger value="evolution" className="flex-1 rounded-xl text-xs">{isFr ? 'Évolution' : 'Evolution'}</TabsTrigger>
          <TabsTrigger value="analysis" className="flex-1 rounded-xl text-xs">{isFr ? 'Analyse' : 'Analysis'}</TabsTrigger>
        </TabsList>

        {/* ─── Overview ─── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pie chart */}
            <Card className="rounded-2xl border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">{isFr ? 'Répartition du patrimoine' : 'Wealth Distribution'}</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={200}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                          paddingAngle={3} dataKey="value" stroke="none">
                          {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {pieData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="truncate flex-1">{d.name}</span>
                          <span className="font-bold tabular-nums">{((d.value / (totalAssets + totalSavings)) * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">{isFr ? 'Ajoutez des actifs pour voir la répartition' : 'Add assets to see distribution'}</p>
                )}
              </CardContent>
            </Card>

            {/* Top assets */}
            <Card className="rounded-2xl border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">{isFr ? 'Top actifs' : 'Top Assets'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {assets.slice(0, 5).map((asset, i) => (
                  <motion.div key={asset.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors">
                    <span className="text-xl">{asset.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{asset.name}</p>
                      <p className="text-[10px] text-muted-foreground">{typeLabel(asset.asset_type)}</p>
                    </div>
                    <p className="text-sm font-bold tabular-nums">{fmt(Number(asset.current_value))}</p>
                  </motion.div>
                ))}
                {assets.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">{isFr ? 'Aucun actif enregistré' : 'No assets yet'}</p>
                )}
                {savingsGoals.length > 0 && (
                  <>
                    <div className="border-t border-border/50 pt-2 mt-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">{isFr ? 'Épargne (auto-agrégée)' : 'Savings (auto-aggregated)'}</p>
                    </div>
                    {savingsGoals.slice(0, 3).map((g, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-xl">
                        <span className="text-xl">{g.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{g.name}</p>
                        </div>
                        <p className="text-sm font-bold tabular-nums text-secondary">{fmt(Number(g.current_amount))}</p>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Assets List ─── */}
        <TabsContent value="assets" className="space-y-4 mt-4">
          <FilterToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={isFr ? 'Rechercher un actif...' : 'Search asset...'}
            filterChips={[
              { label: isFr ? 'Tous' : 'All', value: 'all' },
              ...ASSET_TYPES.map(t => ({ label: t[isFr ? 'label_fr' : 'label_en'], value: t.value })),
            ]}
            activeFilter={filterType}
            onFilterChange={setFilterType}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence mode="popLayout">
              {filteredAssets.map((asset, i) => {
                const gain = Number(asset.current_value) - Number(asset.acquisition_cost || 0);
                const gainPct = asset.acquisition_cost ? (gain / Number(asset.acquisition_cost)) * 100 : 0;
                const vals = allValuations.filter(v => v.asset_id === asset.id);
                return (
                  <motion.div key={asset.id} layout initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.03 }}>
                    <Card className="rounded-2xl border-border/50 hover:shadow-lg transition-shadow group">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{asset.icon}</span>
                            <div>
                              <p className="font-bold text-sm">{asset.name}</p>
                              <p className="text-[10px] text-muted-foreground">{typeLabel(asset.asset_type)} • {asset.category}</p>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openEdit(asset)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive" onClick={() => setDeleteId(asset.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        <div>
                          <p className="text-lg font-extrabold tabular-nums">{fmt(Number(asset.current_value))}</p>
                          {asset.acquisition_cost > 0 && (
                            <p className={`text-[10px] font-bold flex items-center gap-0.5 ${gain >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                              {gain >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {gain >= 0 ? '+' : ''}{fmt(gain)} ({gainPct.toFixed(1)}%)
                            </p>
                          )}
                        </div>

                        {asset.location && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{asset.location}
                          </p>
                        )}
                        {asset.acquisition_date && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />{isFr ? 'Acquis le' : 'Acquired'} {format(new Date(asset.acquisition_date), 'dd MMM yyyy', { locale: isFr ? fr : enUS })}
                          </p>
                        )}

                        <div className="flex gap-1.5 pt-1">
                          <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-lg flex-1"
                            onClick={() => { setValuationDialog(asset.id); setValuationValue(String(asset.current_value)); setValuationDate(new Date().toISOString().split('T')[0]); }}>
                            <TrendingUp className="w-3 h-3 mr-1" />{isFr ? 'Valoriser' : 'Revalue'}
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-lg"
                            onClick={() => handleAIValuation(asset.id)} disabled={aiValuing}>
                            {aiValuing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          </Button>
                          {vals.length > 0 && (
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] rounded-lg"
                              onClick={() => { setHistoryAssetId(asset.id); setActiveTab('evolution'); }}>
                              <Eye className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredAssets.length === 0 && !isLoading && (
            <div className="text-center py-12 space-y-3">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{isFr ? 'Aucun actif trouvé' : 'No assets found'}</p>
            </div>
          )}
        </TabsContent>

        {/* ─── Evolution ─── */}
        <TabsContent value="evolution" className="space-y-4 mt-4">
          {/* Global evolution */}
          <Card className="rounded-2xl border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">{isFr ? 'Évolution de la valeur nette' : 'Net Worth Evolution'}</CardTitle>
            </CardHeader>
            <CardContent>
              {netWorthEvolution.length >= 2 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={netWorthEvolution}>
                    <defs>
                      <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v/1e6).toFixed(1)}M`} className="text-muted-foreground" />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#netWorthGrad)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">{isFr ? 'Ajoutez des valorisations pour voir l\'évolution' : 'Add valuations to see evolution'}</p>
              )}
            </CardContent>
          </Card>

          {/* Per-asset history */}
          {historyAssetId && (
            <Card className="rounded-2xl border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <History className="w-4 h-4" />
                  {isFr ? 'Historique' : 'History'}: {assets.find(a => a.id === historyAssetId)?.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assetValuations.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={assetValuations.map(v => ({ date: format(new Date(v.valued_at), 'dd/MM/yy'), value: v.value }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmt(v)} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="space-y-2">
                    {assetValuations.map(v => (
                      <div key={v.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
                        <span>{format(new Date(v.valued_at), 'dd MMM yyyy', { locale: isFr ? fr : enUS })}</span>
                        <span className="font-bold">{fmt(v.value)}</span>
                        <span className="text-[10px] text-muted-foreground">{v.source}</span>
                      </div>
                    ))}
                    {assetValuations.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{isFr ? 'Aucune valorisation' : 'No valuations'}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 5-Year Projection */}
          <WealthProjectionChart
            assets={assets as any}
            valuations={allValuations}
            totalSavings={totalSavings}
            totalDebt={totalDebt}
            fmt={fmt}
            isFr={isFr}
          />

          {/* Select asset for history */}
          {!historyAssetId && assets.length > 0 && (
            <Card className="rounded-2xl border-border/50">
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-3">{isFr ? 'Sélectionnez un actif pour voir son historique' : 'Select an asset to view its history'}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {assets.map(a => (
                    <button key={a.id} onClick={() => setHistoryAssetId(a.id)}
                      className="flex items-center gap-2 p-2 rounded-xl border border-border/50 hover:bg-muted/50 text-left transition-colors">
                      <span>{a.icon}</span>
                      <span className="text-xs font-semibold truncate">{a.name}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Analysis ─── */}
        <TabsContent value="analysis">
          <WealthAnalysisTab assets={assets} valuations={allValuations} totalSavings={totalSavings} totalDebt={totalDebt} fmt={fmt} isFr={isFr} />
        </TabsContent>
      </Tabs>

      {/* ─── Add/Edit Asset Dialog ─── */}
      <ResponsiveFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditId(null); }}
        title={editId ? (isFr ? 'Modifier l\'actif' : 'Edit Asset') : (isFr ? 'Ajouter un actif' : 'Add Asset')}
        description={isFr ? 'Renseignez les informations de votre bien' : 'Enter your asset details'}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl min-w-[120px]" style={{ background: 'var(--gradient-primary)' }}
              onClick={handleSave} disabled={saving}>{saving ? '...' : t.save}</Button>
          </>
        }
      >
        <div className="space-y-5 py-2 form-animate">
          <FormSection title={isFr ? 'Identification' : 'Identification'} icon={<Package className="w-3.5 h-3.5" />}>
            <div className="flex gap-3">
              <div className="flex-1">
                <InputField
                  label={isFr ? 'Nom de l\'actif' : 'Asset Name'}
                  value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormErrors(e => ({ ...e, name: '' })); }}
                  error={formErrors.name}
                  placeholder={isFr ? 'Ex: Terrain Bingerville' : 'E.g: Downtown Apartment'}
                />
              </div>
              <div className="space-y-1.5 pt-[1.375rem]">
                <Select value={form.icon} onValueChange={v => setForm(f => ({ ...f, icon: v }))}>
                  <SelectTrigger className="rounded-xl h-11 w-16"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICONS.map(ic => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="form-label">{isFr ? 'Type d\'actif' : 'Asset Type'}</Label>
                <Select value={form.asset_type} onValueChange={v => setForm(f => ({ ...f, asset_type: v, category: '', icon: ASSET_TYPES.find(t => t.value === v)?.icon || f.icon }))}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.filter(t => t.value !== 'savings').map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.icon} {t[isFr ? 'label_fr' : 'label_en']}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="form-label">{isFr ? 'Catégorie' : 'Category'}</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={isFr ? 'Choisir...' : 'Choose...'} /></SelectTrigger>
                  <SelectContent>
                    {(CATEGORIES[form.asset_type] || CATEGORIES.other).map(c => (
                      <SelectItem key={c[isFr ? 'label_fr' : 'label_en']} value={c[isFr ? 'label_fr' : 'label_en']}>
                        {c[isFr ? 'label_fr' : 'label_en']}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>

          <FormSection title={isFr ? 'Valorisation' : 'Valuation'} icon={<TrendingUp className="w-3.5 h-3.5" />}>
            <div className="grid grid-cols-2 gap-3">
              <InputField
                label={(isFr ? 'Valeur actuelle' : 'Current Value') + ' *'}
                prefix={isFr ? 'FCFA' : '$'}
                type="number"
                min="0"
                step="1"
                value={form.current_value}
                onChange={e => { setForm(f => ({ ...f, current_value: e.target.value })); setFormErrors(e => ({ ...e, current_value: '' })); }}
                error={formErrors.current_value}
                placeholder="0"
                className="text-lg font-bold"
              />
              <InputField
                label={`${isFr ? 'Coût d\'acquisition' : 'Acquisition Cost'} (${isFr ? 'optionnel' : 'optional'})`}
                prefix={isFr ? 'FCFA' : '$'}
                type="number"
                min="0"
                step="1"
                value={form.acquisition_cost}
                onChange={e => { setForm(f => ({ ...f, acquisition_cost: e.target.value })); setFormErrors(e => ({ ...e, acquisition_cost: '' })); }}
                error={formErrors.acquisition_cost}
                placeholder="0"
              />
            </div>
          </FormSection>

          <FormSection title={isFr ? 'Détails complémentaires' : 'Additional Details'} icon={<MapPin className="w-3.5 h-3.5" />} collapsible defaultOpen={!!form.acquisition_date || !!form.location || !!form.notes}>
            <div className="grid grid-cols-2 gap-3">
              <InputField
                label={`${isFr ? 'Date d\'acquisition' : 'Acquisition Date'} (${isFr ? 'optionnel' : 'optional'})`}
                type="date"
                value={form.acquisition_date}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => { setForm(f => ({ ...f, acquisition_date: e.target.value })); setFormErrors(e => ({ ...e, acquisition_date: '' })); }}
                error={formErrors.acquisition_date}
              />
              <InputField
                label={`${isFr ? 'Localisation' : 'Location'} (${isFr ? 'optionnel' : 'optional'})`}
                icon={<MapPin className="w-3.5 h-3.5" />}
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder={isFr ? 'Ex: Abidjan, Cocody' : 'E.g: Paris, 16th'}
              />
            </div>
            <InputField
              label={`${t.notes} (${isFr ? 'optionnel' : 'optional'})`}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              maxLength={200}
              charCount
              placeholder={isFr ? 'Détails supplémentaires...' : 'Additional details...'}
            />
          </FormSection>
        </div>
      </ResponsiveFormDialog>

      {/* Valuation dialog */}
      <ResponsiveFormDialog
        open={!!valuationDialog}
        onOpenChange={(o) => { if (!o) setValuationDialog(null); }}
        title={isFr ? 'Nouvelle valorisation' : 'New Valuation'}
        description={isFr ? 'Mettez à jour la valeur de cet actif' : 'Update this asset\'s value'}
        footer={
          <>
            <Button variant="outline" onClick={() => setValuationDialog(null)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }}
              onClick={handleAddValuation} disabled={saving}>{t.save}</Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <InputField
            label={isFr ? 'Nouvelle valeur' : 'New Value'}
            prefix={isFr ? 'FCFA' : '$'}
            type="number"
            min="0"
            value={valuationValue}
            onChange={e => setValuationValue(e.target.value)}
            className="text-lg font-bold"
          />
          <InputField
            label={t.date}
            type="date"
            value={valuationDate}
            onChange={e => setValuationDate(e.target.value)}
          />
          <InputField
            label={t.notes}
            value={valuationNotes}
            onChange={e => setValuationNotes(e.target.value)}
            placeholder={isFr ? 'Raison de la réévaluation...' : 'Reason for revaluation...'}
          />
        </div>
      </ResponsiveFormDialog>

      <ConfirmDeleteDialog
        open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}
        onConfirm={handleDelete}
        title={isFr ? 'Supprimer cet actif' : 'Delete Asset'}
        description={isFr ? 'Cette action est irréversible.' : 'This action cannot be undone.'}
        cancelLabel={t.cancel} confirmLabel={t.delete}
      />
    </div>
  );
};

export default WealthPage;
