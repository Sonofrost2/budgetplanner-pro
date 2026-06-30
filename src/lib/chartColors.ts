/**
 * Palette de couleurs centralisée pour tous les charts.
 * Inclut des tokens semantiques en priorité (theme-aware) + un fallback
 * de couleurs vives cohérentes avec le design system glassmorphism dark.
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