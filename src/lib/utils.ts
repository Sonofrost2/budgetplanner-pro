import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Abbreviate large numbers: 1500000 → "1.5M", 250000 → "250K" */
export function abbreviateNumber(n: number, locale: string = 'fr'): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'G';
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (abs >= 1_000) return sign + (abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return sign + abs.toFixed(0);
}

/** Group chart data to top N + "Autres/Other" */
export function groupTopN<T extends { name: string; value: number }>(
  data: T[], n: number = 5, locale: string = 'fr'
): T[] {
  if (data.length <= n) return data;
  const top = data.slice(0, n);
  const rest = data.slice(n);
  const otherValue = rest.reduce((s, d) => s + d.value, 0);
  const otherItem = { name: locale === 'fr' ? 'Autres' : 'Other', value: otherValue, color: '#94A3B8' } as T;
  return [...top, otherItem];
}
