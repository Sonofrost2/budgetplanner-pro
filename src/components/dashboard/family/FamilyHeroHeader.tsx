import { motion } from 'framer-motion';
import { Users, Plus, Share2, TrendingUp } from 'lucide-react';
import { HeroHeaderShell } from '@/components/dashboard/HeroHeaderShell';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/ui/animated-number';

interface Props {
  groupCount: number;
  memberCount: number;
  sharedBudgetsCount: number;
  monthlyExpense: number;
  currency: string;
  selectedGroupName?: string | null;
  onCreate: () => void;
  canCreate: boolean;
}

export const FamilyHeroHeader = ({
  groupCount, memberCount, sharedBudgetsCount, monthlyExpense, currency,
  selectedGroupName, onCreate, canCreate,
}: Props) => {
  return (
    <HeroHeaderShell topBlobClassName="bg-primary/25" bottomBlobClassName="bg-accent/15">
      <div className="flex flex-col lg:flex-row lg:items-end gap-6 justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 backdrop-blur px-3 py-1 text-xs font-semibold text-primary uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" />
            Famille
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Coach Famille
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              {selectedGroupName
                ? <>👨‍👩‍👧 Vous gérez <strong className="text-foreground">{selectedGroupName}</strong> · {memberCount} membre{memberCount > 1 ? 's' : ''}</>
                : <>Créez un groupe familial pour partager budgets et suivre les dépenses ensemble.</>}
            </p>
          </div>
        </div>

        <Button
          onClick={onCreate}
          disabled={!canCreate}
          size="lg"
          className="text-primary-foreground shadow-lg"
          style={{ background: 'var(--gradient-primary)' }}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nouveau groupe
        </Button>
      </div>

      {/* KPI strip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-border/50"
      >
        <KpiTile icon={<Users className="w-4 h-4" />} label="Groupes" value={groupCount} accent="primary" />
        <KpiTile icon={<Users className="w-4 h-4" />} label="Membres" value={memberCount} accent="primary" />
        <KpiTile icon={<Share2 className="w-4 h-4" />} label="Budgets partagés" value={sharedBudgetsCount} accent="accent" />
        <KpiTile icon={<TrendingUp className="w-4 h-4" />} label="Dépenses (période)" value={monthlyExpense} suffix={` ${currency}`} accent="accent" />
      </motion.div>
    </HeroHeaderShell>
  );
};

interface KpiTileProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  accent: 'primary' | 'accent';
}
const KpiTile = ({ icon, label, value, suffix, accent }: KpiTileProps) => {
  const color = accent === 'primary' ? 'text-primary' : 'text-accent';
  return (
    <div className="rounded-xl bg-background/40 backdrop-blur border border-border/50 p-3 hover:bg-background/60 transition-colors">
      <div className={`flex items-center gap-1.5 ${color} mb-1`}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label}</span>
      </div>
      <div className="text-xl font-bold font-display tabular-nums">
        <AnimatedNumber value={value} />{suffix || ''}
      </div>
    </div>
  );
};
