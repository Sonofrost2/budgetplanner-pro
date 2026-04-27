import { Button } from '@/components/ui/button';
import { InputField } from '@/components/ui/input-field';
import { ResponsiveFormDialog } from '@/components/ui/responsive-form-dialog';
import { AccountCombobox } from '@/components/dashboard/AccountCombobox';
import { Label } from '@/components/ui/label';
import { Sparkles, TrendingUp, Lock, Lightbulb, BarChart3, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { currencySymbol, exampleAmount, amountLabel } from '@/lib/currency';
import type { Account, SavingsGoal } from '@/hooks/useDashboardData';

interface ScenarioData {
  monthly_projections: { month: number; capital: number; interest_earned: number; total: number }[];
  interest_income_1y: number;
  interest_income_3y: number;
  interest_income_5y: number;
  estimated_goal_date?: string | null;
}

interface SimulationResult {
  continue: ScenarioData;
  stop_now: ScenarioData;
  interest_lost: number;
  recommendations: string[];
  summary: string;
}

// ─── Add Contribution Dialog ──────────────────────────
export const AddContributionDialog = ({
  open, onClose, amount, setAmount, sourceAccountId, setSourceAccountId,
  accounts, goal, onSave, saving, t, locale, currency = 'EUR'
}: {
  open: boolean; onClose: () => void; amount: string; setAmount: (v: string) => void;
  sourceAccountId: string; setSourceAccountId: (v: string) => void;
  accounts: Account[]; goal: SavingsGoal | undefined;
  onSave: () => void; saving: boolean; t: any; locale: string; currency?: string;
}) => (
  <ResponsiveFormDialog
    open={open}
    onOpenChange={onClose}
    title={t.addSaving}
    description={locale === 'fr' ? 'Ajoutez un versement à cet objectif.' : 'Add a contribution to this goal.'}
    className="sm:max-w-md"
    footer={
      <>
        <Button variant="outline" onClick={onClose} className="rounded-xl">{t.cancel}</Button>
        <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={onSave} disabled={saving}>
          {saving ? t.saving : t.save}
        </Button>
      </>
    }
  >
    <div className="space-y-4">
      <InputField
        type="number" min="0.01" step="0.01"
        value={amount}
        onChange={e => setAmount((e.target as HTMLInputElement).value)}
        prefix={currencySymbol(currency)}
        label={amountLabel(t.amount, currency)}
        placeholder={exampleAmount(currency, locale)}
      />
      <div className="space-y-2">
        <Label className="form-label">{t.savingsSourceAccount} ({t.optional})</Label>
        <AccountCombobox accounts={accounts} value={sourceAccountId} onValueChange={setSourceAccountId}
          placeholder={locale === 'fr' ? 'Débiter depuis...' : 'Debit from...'} excludeId={goal?.account_id} />
      </div>
      {goal?.payment_accounts && (
        <div className="bg-muted/50 rounded-xl p-3 text-sm">
          <span className="text-muted-foreground">{t.savingsTargetAccount}: </span>
          <span className="font-medium">{goal.payment_accounts?.icon} {goal.payment_accounts?.name}</span>
        </div>
      )}
    </div>
  </ResponsiveFormDialog>
);

// ─── Withdraw Dialog ──────────────────────────────────
export const WithdrawDialog = ({
  open, onClose, amount, setAmount, targetAccountId, setTargetAccountId,
  accounts, goal, onSave, saving, fmt, t, locale, currency = 'EUR'
}: {
  open: boolean; onClose: () => void; amount: string; setAmount: (v: string) => void;
  targetAccountId: string; setTargetAccountId: (v: string) => void;
  accounts: Account[]; goal: SavingsGoal | undefined;
  onSave: () => void; saving: boolean; fmt: (n: number) => string; t: any; locale: string; currency?: string;
}) => (
  <ResponsiveFormDialog
    open={open}
    onOpenChange={onClose}
    title={t.withdrawSaving}
    description={t.savingsWithdrawDesc}
    className="sm:max-w-md"
    footer={
      <>
        <Button variant="outline" onClick={onClose} className="rounded-xl">{t.cancel}</Button>
        <Button variant="destructive" className="rounded-xl" onClick={onSave} disabled={saving}>
          {saving ? t.saving : t.withdrawSaving}
        </Button>
      </>
    }
  >
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-xl p-3 text-sm">
        <span className="text-muted-foreground">{locale === 'fr' ? 'Disponible' : 'Available'}: </span>
        <span className="font-bold">{fmt(Number(goal?.current_amount || 0))}</span>
      </div>
      <InputField
        type="number" min="0.01" step="0.01" max={goal?.current_amount || 0}
        value={amount}
        onChange={e => setAmount((e.target as HTMLInputElement).value)}
        prefix={currencySymbol(currency)}
        label={amountLabel(t.withdrawAmount, currency)}
        placeholder={exampleAmount(currency, locale)}
      />
      <div className="space-y-2">
        <Label className="form-label">{t.savingsTargetAccount} ({t.optional})</Label>
        <AccountCombobox accounts={accounts} value={targetAccountId} onValueChange={setTargetAccountId}
          placeholder={locale === 'fr' ? 'Créditer vers...' : 'Credit to...'} excludeId={goal?.account_id} />
      </div>
    </div>
  </ResponsiveFormDialog>
);

// ─── AI Simulation Dialog ─────────────────────────────
export const SimulationDialog = ({
  open, onClose, goal, simulation, simulating, onExportPDF, fmt, t, locale
}: {
  open: boolean; onClose: () => void; goal: SavingsGoal | undefined;
  simulation: SimulationResult | null; simulating: boolean;
  onExportPDF: () => void; fmt: (n: number) => string; t: any; locale: string;
}) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          {t.simulationTitle}
          {goal && <span className="text-muted-foreground font-normal">— {goal.icon} {goal.name}</span>}
        </DialogTitle>
      </DialogHeader>
      {simulating ? (
        <div className="py-12 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-primary mx-auto animate-pulse" />
          <p className="text-sm text-muted-foreground">{t.simulating}</p>
        </div>
      ) : simulation ? (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div className="bg-muted/50 rounded-xl p-4 flex-1">
              <p className="text-sm">{simulation.summary}</p>
            </div>
            <Button size="sm" variant="outline" className="rounded-xl shrink-0" onClick={onExportPDF}>
              <Download className="w-4 h-4 mr-1" />{t.exportPDF}
            </Button>
          </div>

          {simulation.interest_lost > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-destructive" />
              <span className="text-sm"><strong>{t.ifYouStopToday}</strong> {fmt(simulation.interest_lost)} {t.inInterest}</span>
            </div>
          )}

          {simulation.continue.monthly_projections?.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5" />{t.comparisonChart}
              </h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={simulation.continue.monthly_projections.map((p, i) => ({
                    month: p.month, continue_total: p.total,
                    stop_total: simulation.stop_now.monthly_projections?.[i]?.total ?? p.total,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(v)} />
                    <Tooltip formatter={(value: number, name: string) => [fmt(value), name === 'continue_total' ? t.scenarioContinue : t.scenarioStopNow]}
                      contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }} />
                    <Legend formatter={(value: string) => value === 'continue_total' ? t.scenarioContinue : t.scenarioStopNow} />
                    <Line type="monotone" dataKey="continue_total" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="stop_total" stroke="hsl(var(--destructive))" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <Tabs defaultValue="continue" className="w-full">
            <TabsList className="rounded-xl mb-4 w-full">
              <TabsTrigger value="continue" className="rounded-lg flex-1 gap-1.5 text-xs">
                <TrendingUp className="w-3.5 h-3.5" />{t.scenarioContinue}
              </TabsTrigger>
              <TabsTrigger value="stop" className="rounded-lg flex-1 gap-1.5 text-xs">
                <Lock className="w-3.5 h-3.5" />{t.scenarioStopNow}
              </TabsTrigger>
            </TabsList>
            {(['continue', 'stop'] as const).map(scenario => {
              const data = scenario === 'continue' ? simulation.continue : simulation.stop_now;
              return (
                <TabsContent key={scenario} value={scenario === 'continue' ? 'continue' : 'stop'}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: t.interestIncome1y, value: data.interest_income_1y },
                        { label: t.interestIncome3y, value: data.interest_income_3y },
                        { label: t.interestIncome5y, value: data.interest_income_5y },
                      ].map((item, i) => (
                        <div key={i} className="bg-primary/10 rounded-xl p-3 text-center">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{item.label}</p>
                          <p className="text-lg font-bold text-primary mt-1">{fmt(item.value)}</p>
                        </div>
                      ))}
                    </div>
                    {data.estimated_goal_date && (
                      <div className="bg-secondary/10 rounded-xl p-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-secondary" />
                        <span className="text-sm"><strong>{t.estimatedGoalDate}:</strong> {data.estimated_goal_date}</span>
                      </div>
                    )}
                    {data.monthly_projections?.length > 0 && (
                      <div className="overflow-x-auto rounded-xl border border-border/50 max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0">
                            <tr className="bg-muted/50">
                              <th className="text-left p-2 font-medium">{locale === 'fr' ? 'Mois' : 'Month'}</th>
                              <th className="text-right p-2 font-medium">Capital</th>
                              <th className="text-right p-2 font-medium">{locale === 'fr' ? 'Intérêts' : 'Interest'}</th>
                              <th className="text-right p-2 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.monthly_projections.map(p => (
                              <tr key={p.month} className="border-t border-border/30">
                                <td className="p-2">{p.month}</td>
                                <td className="text-right p-2">{fmt(p.capital)}</td>
                                <td className="text-right p-2 text-secondary">{fmt(p.interest_earned)}</td>
                                <td className="text-right p-2 font-bold">{fmt(p.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>

          {simulation.recommendations?.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5" />{t.aiRecommendations}
              </h4>
              <div className="space-y-2">
                {simulation.recommendations.map((r, i) => (
                  <div key={i} className="bg-muted/40 rounded-lg p-3 text-sm flex gap-2">
                    <span className="text-primary font-bold">{i + 1}.</span><span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </DialogContent>
  </Dialog>
);
