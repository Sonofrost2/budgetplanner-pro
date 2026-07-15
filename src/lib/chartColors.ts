/**
 * Palette de couleurs centralisée pour tous les charts.
 */
export const CHART_PALETTE: readonly string[] = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  '#F59E0B', // amber
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#22C55E', // emerald
  '#EF4444', // red
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#06B6D4', // cyan
];

/** Renvoie une couleur stable basée sur l'index. */
export function getChartColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

// === Tokens sémantiques (theme-aware) ===
export const CHART_POSITIVE = 'hsl(var(--success, 142 76% 45%))';
export const CHART_NEGATIVE = 'hsl(var(--destructive))';
export const CHART_INCOME = CHART_POSITIVE;
export const CHART_EXPENSE = CHART_NEGATIVE;
export const CHART_ALERT = 'hsl(var(--warning, 38 92% 50%))';
export const CHART_NEUTRAL = 'hsl(var(--muted-foreground))';

// Axes / grilles / tooltip
export const CHART_GRID = 'hsl(var(--border))';
export const CHART_AXIS = 'hsl(var(--muted-foreground))';
export const CHART_TOOLTIP_BG = 'hsl(var(--popover))';

/**
 * Shared tooltip contentStyle for Recharts. Uses semantic tokens so contrast
 * stays WCAG AA in both light and dark themes (previously the tooltip inherited
 * the browser default text color which failed contrast on dark popovers).
 */
export const CHART_TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: '1px solid hsl(var(--border))',
  background: CHART_TOOLTIP_BG,
  color: 'hsl(var(--popover-foreground))',
  boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
  fontSize: '12px',
  padding: '8px 12px',
} as const;

export const CHART_TOOLTIP_LABEL_STYLE = {
  color: 'hsl(var(--popover-foreground))',
  fontWeight: 600,
  fontSize: 12,
} as const;

export const CHART_TOOLTIP_ITEM_STYLE = {
  color: 'hsl(var(--popover-foreground))',
} as const;

// Couleurs par type de compte (utilisé par AccountsHeroHeader)
export const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  checking: 'hsl(var(--primary))',
  savings: 'hsl(var(--secondary))',
  cash: '#F59E0B',
  credit: '#EF4444',
  investment: '#8B5CF6',
  mobile_money: '#22C55E',
  other: 'hsl(var(--muted-foreground))',
};