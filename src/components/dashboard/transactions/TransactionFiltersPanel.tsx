import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Tag, CreditCard, Calendar, TrendingUp, TrendingDown, ArrowLeftRight, Users, Lock, Scale } from 'lucide-react';
import type { Category, Account } from '@/hooks/useDashboardData';
import type { DashTranslations } from '@/i18n/dashTranslations';

export interface TransactionFiltersPanelProps {
  categories: Category[];
  accounts: Account[];
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  filterAccount: string;
  setFilterAccount: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  hideTransfers: boolean;
  setHideTransfers: (fn: (v: boolean) => boolean) => void;
  privacyFilter: 'all' | 'family' | 'private';
  setPrivacyFilter: (v: 'all' | 'family' | 'private') => void;
  isRegularizationActive: boolean;
  onToggleRegularization: () => void;
  t: DashTranslations;
  locale: string;
}

/**
 * Filter body shared by the persistent desktop sidebar and the mobile sheet.
 * Every control writes straight to the page state (persisted via
 * usePersistedState) so results refresh immediately — no "apply" step.
 */
export const TransactionFiltersPanel = ({
  categories, accounts,
  filterCategory, setFilterCategory,
  filterAccount, setFilterAccount,
  startDate, setStartDate, endDate, setEndDate,
  hideTransfers, setHideTransfers,
  privacyFilter, setPrivacyFilter,
  isRegularizationActive, onToggleRegularization,
  t, locale,
}: TransactionFiltersPanelProps) => {
  const fr = locale === 'fr';

  return (
    <div className="space-y-6">
      {/* Category */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Tag className="w-3 h-3" /> {t.category}
          </label>
          {filterCategory !== 'all' && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground hover:text-destructive" onClick={() => setFilterCategory('all')}>
              <X className="w-3 h-3 mr-0.5" />{fr ? 'Réinitialiser' : 'Reset'}
            </Button>
          )}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={`w-full h-10 rounded-xl text-xs gap-1.5 border-border/40 bg-background/60 hover:bg-background/80 transition-all duration-200 justify-start font-medium ${filterCategory !== 'all' ? 'border-primary/30 bg-primary/5 text-primary' : ''}`}>
              <Tag className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {filterCategory !== 'all'
                  ? (() => { const cat = categories.find(c => c.id === filterCategory); return cat ? `${cat.icon} ${cat.name}` : t.category; })()
                  : (fr ? 'Toutes les catégories' : 'All categories')}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 rounded-xl overflow-hidden" align="start">
            <div className="p-3 border-b border-border/50 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">{fr ? 'Filtrer par catégorie' : 'Filter by category'}</span>
                {filterCategory !== 'all' && (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground hover:text-destructive" onClick={() => setFilterCategory('all')}>
                    <X className="w-3 h-3 mr-0.5" />{fr ? 'Réinitialiser' : 'Reset'}
                  </Button>
                )}
              </div>
            </div>
            <ScrollArea className="h-72">
              <div className="p-2">
                <button
                  onClick={() => setFilterCategory('all')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${filterCategory === 'all' ? 'bg-primary/10 text-primary font-semibold shadow-sm' : 'hover:bg-muted/50'}`}
                >
                  <span className="text-base">📋</span>
                  <span>{t.all} {t.category}</span>
                </button>

                {(['income', 'expense'] as const).map(type => {
                  const list = categories.filter(c => c.type === type);
                  if (!list.length) return null;
                  return (
                    <div key={type}>
                      <div className={`px-3 py-2 mt-3 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${type === 'income' ? 'text-secondary' : 'text-destructive'}`}>
                        {type === 'income' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {type === 'income' ? t.incomeType : t.expenseType}
                      </div>
                      {list.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setFilterCategory(filterCategory === c.id ? 'all' : c.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${filterCategory === c.id ? 'bg-primary/10 text-primary font-semibold shadow-sm' : 'hover:bg-muted/50'}`}
                        >
                          <span className="text-base">{c.icon}</span>
                          <span className="truncate">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
        <button
          type="button"
          onClick={onToggleRegularization}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs border transition-all duration-200 ${
            isRegularizationActive
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40'
              : 'bg-background/60 text-muted-foreground border-border/40 hover:border-amber-500/30 hover:text-amber-600 dark:hover:text-amber-400'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5" />
            {fr ? 'Uniquement les régularisations' : 'Only adjustments'}
          </span>
          {isRegularizationActive && <X className="w-3 h-3 opacity-70" />}
        </button>
      </div>

      {/* Account */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <CreditCard className="w-3 h-3" /> {t.account}
          </label>
          {filterAccount !== 'all' && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground hover:text-destructive" onClick={() => setFilterAccount('all')}>
              <X className="w-3 h-3 mr-0.5" />{fr ? 'Réinitialiser' : 'Reset'}
            </Button>
          )}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={`w-full h-10 rounded-xl text-xs gap-1.5 border-border/40 bg-background/60 hover:bg-background/80 transition-all duration-200 justify-start font-medium ${filterAccount !== 'all' ? 'border-primary/30 bg-primary/5 text-primary' : ''}`}>
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {filterAccount !== 'all'
                  ? (() => { const acc = accounts.find(a => a.id === filterAccount); return acc ? `${acc.icon} ${acc.name}` : t.allAccounts; })()
                  : t.allAccounts}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0 rounded-xl overflow-hidden" align="start">
            <div className="p-3 border-b border-border/50 bg-muted/30">
              <span className="text-xs font-semibold text-muted-foreground">{fr ? 'Filtrer par compte' : 'Filter by account'}</span>
            </div>
            <ScrollArea className="h-64">
              <div className="p-2">
                <button
                  onClick={() => setFilterAccount('all')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${filterAccount === 'all' ? 'bg-primary/10 text-primary font-semibold shadow-sm' : 'hover:bg-muted/50'}`}
                >
                  <span className="text-base">🏦</span>
                  <span>{t.allAccounts}</span>
                </button>
                {accounts.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setFilterAccount(filterAccount === a.id ? 'all' : a.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${filterAccount === a.id ? 'bg-primary/10 text-primary font-semibold shadow-sm' : 'hover:bg-muted/50'}`}
                  >
                    <span className="text-base">{a.icon}</span>
                    <span className="truncate">{a.name}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {/* Visibility */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {fr ? 'Visibilité' : 'Visibility'}
        </label>
        <button
          type="button"
          onClick={() => setHideTransfers(v => !v)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs border transition-all duration-200 ${
            hideTransfers
              ? 'bg-primary/15 text-primary border-primary/40'
              : 'bg-background/60 text-muted-foreground border-border/40 hover:border-primary/30 hover:text-primary'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {fr ? 'Masquer les transferts' : 'Hide transfers'}
          </span>
          {hideTransfers && <X className="w-3 h-3 opacity-70" />}
        </button>

        <div className="grid grid-cols-3 gap-1 p-0.5 bg-muted/40 rounded-xl">
          {[
            { value: 'all' as const, label: t.all, icon: null },
            { value: 'family' as const, label: fr ? 'Famille' : 'Family', icon: <Users className="w-3.5 h-3.5" /> },
            { value: 'private' as const, label: fr ? 'Privées' : 'Private', icon: <Lock className="w-3.5 h-3.5" /> },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setPrivacyFilter(opt.value)}
              className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                privacyFilter === opt.value ? 'bg-background text-foreground shadow-sm border border-border/50' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.icon}<span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Date range */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Calendar className="w-3 h-3" /> {fr ? 'Période' : 'Period'}
        </label>
        <div className="flex items-center gap-1.5">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 rounded-xl h-9 border-border/40 bg-background/60 hover:bg-background/80 text-xs transition-colors" />
          <span className="text-xs text-muted-foreground">→</span>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 rounded-xl h-9 border-border/40 bg-background/60 hover:bg-background/80 text-xs transition-colors" />
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-lg text-[10px] px-2 border-border/40"
            onClick={() => {
              const now = new Date();
              setStartDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
              const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
              setEndDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`);
            }}
          >
            {t.thisMonth}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-lg text-[10px] px-2 border-border/40"
            onClick={() => {
              const now = new Date();
              const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              setStartDate(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`);
              const lastDay = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
              setEndDate(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${lastDay}`);
            }}
          >
            {t.lastMonth}
          </Button>
          {(startDate || endDate) && (
            <Button variant="ghost" size="sm" className="h-7 rounded-lg text-[10px] px-2 text-muted-foreground hover:text-destructive" onClick={() => { setStartDate(''); setEndDate(''); }}>
              <X className="w-3 h-3 mr-0.5" />{fr ? 'Effacer' : 'Clear'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionFiltersPanel;
