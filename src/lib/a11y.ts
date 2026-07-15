/**
 * Small accessibility helpers used across the Budget & Reports views.
 *
 * The Recharts primitives render inline <svg>s that screen readers ignore by
 * default. Wrapping them with `chartA11yProps(...)` (role="img" + aria-label)
 * exposes a short, human-readable summary. When a full breakdown is needed,
 * pair the chart with a visually-hidden table using `srOnly`.
 */
export function chartA11yProps(label: string, description?: string) {
  return {
    role: 'img' as const,
    'aria-label': description ? `${label}. ${description}` : label,
    tabIndex: 0,
  };
}

/** Tailwind utility that hides content visually but keeps it for assistive tech. */
export const srOnly = 'sr-only';

/** Encode the current sort direction as an `aria-sort` value. */
export function ariaSortValue(
  isActive: boolean,
  direction: 'asc' | 'desc',
): 'ascending' | 'descending' | 'none' {
  if (!isActive) return 'none';
  return direction === 'asc' ? 'ascending' : 'descending';
}