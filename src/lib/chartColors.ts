/**
 * Shared chart palette. Keeps gradient stops, axes and grid colors
 * consistent across StatsCards, Reports, Accounts and Charts sections.
 * Update once here to retheme every chart.
 */

export const CHART_INCOME = 'hsl(165, 70%, 46%)';
export const CHART_EXPENSE = 'hsl(250, 85%, 60%)';
export const CHART_POSITIVE = CHART_INCOME;
export const CHART_NEGATIVE = 'hsl(0, 84%, 60%)';
export const CHART_ALERT = 'hsl(340, 80%, 55%)';
export const CHART_GRID = 'hsl(225, 15%, 88%)';
export const CHART_AXIS = 'hsl(225, 10%, 45%)';

/** Accent hues used for categorical series (pies, multi-line charts…). */
export const CHART_WARNING = 'hsl(35, 92%, 55%)';
export const CHART_INFO = 'hsl(200, 80%, 50%)';
export const CHART_PURPLE = 'hsl(280, 65%, 55%)';
export const CHART_ORANGE = 'hsl(15, 85%, 55%)';
export const CHART_GREEN_DARK = 'hsl(130, 55%, 45%)';
export const CHART_YELLOW = 'hsl(45, 90%, 50%)';
export const CHART_BLUE = 'hsl(217, 91%, 60%)';

/** Default categorical palette — keep order stable. */
export const CHART_PALETTE = [
  CHART_INCOME,
  CHART_EXPENSE,
  CHART_WARNING,
  CHART_ALERT,
  CHART_INFO,
  CHART_PURPLE,
  CHART_ORANGE,
  CHART_GREEN_DARK,
  CHART_YELLOW,
];

/** Tooltip background — uses CSS theme token so it adapts to dark mode. */
export const CHART_TOOLTIP_BG = 'hsl(var(--card))';

/** Palette mapped to account types (bank/cash/mobile/...). */
export const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  bank: CHART_BLUE,
  mobile_money: CHART_WARNING,
  cash: CHART_INCOME,
  card: CHART_PURPLE,
  savings: CHART_ALERT,
};
