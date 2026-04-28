import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { useInvalidate } from '@/hooks/useDashboardData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Link2, Unlink, Search, PiggyBank, Target, ArrowRight, AlertTriangle, Pencil } from 'lucide-react';
import { coachToast } from '@/lib/coachToast';
import { amountLabel } from '@/lib/currency';
import { useProfile } from '@/hooks/useProfile';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';

interface LinkRow {
  budgetId: string;
  budgetName: string;
  budgetAmount: number;
  budgetPeriod: string;
  budgetExpectedDay: number | null;
  goalId: string;
  goalName: string;
  goalIcon: string;
  goalTarget: number;
  goalCurrent: number;
  goalMonthly: number | null;
  goalContributionDay: number | null;
  mismatch: string[];
}

export default function BudgetSavingsLinksPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { language } = useLanguage();
  const invalidate = useInvalidate();
  const isFr = language === 'fr';
  const currency = profile?.currency || 'XOF';

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [search, setSearch] = useState('');
  const [confirmRow, setConfirmRow] = useState<LinkRow | null>(null);
  const [busy, setBusy] = useState(false);

  const t = (fr: string, en: string) => (isFr ? fr : en);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: budgets }, { data: goals }] = await Promise.all([
      supabase.from('budgets').select('id, name, amount, period, expected_day, linked_savings_goal_id').eq('user_id', user.id).is('deleted_at', null).not('linked_savings_goal_id', 'is', null),
      supabase.from('savings_goals').select('id, name, icon, target_amount, current_amount, monthly_contribution, contribution_day, linked_budget_id').eq('user_id', user.id).is('deleted_at', null),
    ]);
    const goalById = new Map((goals || []).map((g: any) => [g.id, g]));
    const result: LinkRow[] = [];
    (budgets || []).forEach((b: any) => {
      const g = goalById.get(b.linked_savings_goal_id);
      if (!g) return;
      const mismatch: string[] = [];
      if (b.period === 'monthly' && Math.abs(Number(b.amount) - Number(g.monthly_contribution || 0)) > 1) {
        mismatch.push(t('Montant', 'Amount'));
      }
      if (b.expected_day && g.contribution_day && b.expected_day !== g.contribution_day) {
        mismatch.push(t('Jour', 'Day'));
      }
      result.push({
        budgetId: b.id,
        budgetName: b.name,
        budgetAmount: Number(b.amount),
        budgetPeriod: b.period,
        budgetExpectedDay: b.expected_day,
        goalId: g.id,
        goalName: g.name,
        goalIcon: g.icon || '🎯',
        goalTarget: Number(g.target_amount),
        goalCurrent: Number(g.current_amount || 0),
        goalMonthly: g.monthly_contribution ? Number(g.monthly_contribution) : null,
        goalContributionDay: g.contribution_day,
        mismatch,
      });
    });
    setRows(result);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.budgetName.toLowerCase().includes(q) || r.goalName.toLowerCase().includes(q));
  }, [rows, search]);

  const handleUnlink = async (row: LinkRow) => {
    setBusy(true);
    try {
      // SQL trigger sync_budget_savings_link will mirror the change on the goal side
      const { error } = await supabase
        .from('budgets')
        .update({ linked_savings_goal_id: null })
        .eq('id', row.budgetId);
      if (error) throw error;
      // Belt & suspenders : also clear from goal in case trigger lags
      await supabase.from('savings_goals').update({ linked_budget_id: null }).eq('id', row.goalId);
      coachToast.success({
        title: t('Liaison supprimée', 'Link removed'),
        description: t(`${row.budgetName} ⇎ ${row.goalName}`, `${row.budgetName} ⇎ ${row.goalName}`),
      });
      setConfirmRow(null);
      setRows(prev => prev.filter(r => r.budgetId !== row.budgetId));
      invalidate.budgets();
      invalidate.savings();
    } catch (e: any) {
      coachToast.error({ title: t('Erreur', 'Error'), description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('Liens Budget ↔ Épargne', 'Budget ↔ Savings Links')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t(
            'Visualisez et gérez toutes vos liaisons entre budgets et objectifs d’épargne.',
            'View and manage all links between your budgets and savings goals.'
          )}
        </p>
      </div>

      <Card className="glass">
        <CardContent className="p-4 flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('Rechercher un budget ou un objectif…', 'Search a budget or a goal…')}
            className="border-0 bg-transparent focus-visible:ring-0"
          />
          <Badge variant="secondary">
            {filtered.length} {t('liaison(s)', 'link(s)')}
          </Badge>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="glass">
          <CardContent className="p-10 text-center space-y-3">
            <Link2 className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {search
                ? t('Aucun résultat pour cette recherche.', 'No results for this search.')
                : t('Aucune liaison pour le moment.', 'No links yet.')}
            </p>
            <div className="flex gap-2 justify-center">
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/budgets">
                  <PiggyBank className="w-4 h-4 mr-2" /> {t('Aller aux budgets', 'Go to budgets')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/savings">
                  <Target className="w-4 h-4 mr-2" /> {t('Aller à l’épargne', 'Go to savings')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(row => (
            <Card key={row.budgetId} className="glass hover-lift">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Budget side */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <PiggyBank className="w-3.5 h-3.5" /> {t('Budget', 'Budget')}
                    </div>
                    <p className="font-semibold truncate">{row.budgetName}</p>
                    <p className="text-sm text-muted-foreground">
                      {amountLabel(row.budgetAmount, currency)} · {row.budgetPeriod}
                      {row.budgetExpectedDay ? ` · J${row.budgetExpectedDay}` : ''}
                    </p>
                  </div>

                  <ArrowRight className="hidden md:block w-5 h-5 text-primary/60 shrink-0" />

                  {/* Goal side */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Target className="w-3.5 h-3.5" /> {t('Objectif', 'Goal')}
                    </div>
                    <p className="font-semibold truncate">
                      <span className="mr-1">{row.goalIcon}</span>
                      {row.goalName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {amountLabel(row.goalCurrent, currency)} / {amountLabel(row.goalTarget, currency)}
                      {row.goalMonthly ? ` · ${amountLabel(row.goalMonthly, currency)}/${t('mois', 'mo')}` : ''}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {row.mismatch.length > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {t('Divergent', 'Mismatch')}: {row.mismatch.join(', ')}
                      </Badge>
                    )}
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/dashboard/budgets?edit=${row.budgetId}`}>
                          <Pencil className="w-3.5 h-3.5 mr-1.5" /> {t('Modifier', 'Edit')}
                        </Link>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmRow(row)}
                      >
                        <Unlink className="w-3.5 h-3.5 mr-1.5" /> {t('Délier', 'Unlink')}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!confirmRow}
        onOpenChange={(o) => !o && setConfirmRow(null)}
        title={t('Supprimer la liaison ?', 'Remove this link?')}
        description={
          confirmRow
            ? t(
                `Le budget « ${confirmRow.budgetName} » et l’objectif « ${confirmRow.goalName} » ne seront plus liés. Aucune donnée ne sera supprimée.`,
                `The budget "${confirmRow.budgetName}" and the goal "${confirmRow.goalName}" will no longer be linked. No data will be deleted.`
              )
            : ''
        }
        confirmLabel={t('Délier', 'Unlink')}
        loading={busy}
        onConfirm={() => confirmRow && handleUnlink(confirmRow)}
      />
    </div>
  );
}
