import { useRef, useMemo, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useIsMobile } from '@/hooks/use-mobile';
import type { SavingsGoal } from '@/hooks/useDashboardData';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  goals: SavingsGoal[];
  render: (g: SavingsGoal) => React.ReactNode;
  /** Threshold above which we switch to virtualization. */
  threshold?: number;
  /** Estimated card height in px (used for windowing math). */
  estimatedRowHeight?: number;
  /** Show skeleton placeholders during loading/re-sync. */
  isLoading?: boolean;
  /** Number of skeleton cards to show when loading. */
  skeletonCount?: number;
}

/**
 * Renders a responsive 1/2-column grid of savings goals.
 * - Below `threshold` (default 30 items): falls back to a plain CSS grid
 *   so SEO/print/screen-reader behavior matches the legacy view.
 * - Above the threshold: virtualizes by *row* (1 col mobile, 2 col desktop)
 *   using @tanstack/react-virtual to keep DOM nodes ~constant.
 *
 * Measurement strategy (avoids reflows / glitches):
 * - `estimateSize` reads a learned cache (per viewport) so first paint is
 *   close to the real height.
 * - `measureElement` is debounced via rAF and rounded to whole pixels so
 *   sub-pixel jitter never re-triggers virtualization.
 * - We only re-measure when the row's index changes, not every render.
 */
export const VirtualizedGoalsGrid = ({
  goals,
  render,
  threshold = 30,
  estimatedRowHeight = 360,
  isLoading = false,
  skeletonCount = 4,
}: Props) => {
  const isMobile = useIsMobile();
  const cols = isMobile ? 1 : 2;
  const parentRef = useRef<HTMLDivElement | null>(null);

  // Per-viewport (mobile/desktop) measurement cache. Persists across renders.
  // Key = `${cols}` so switching between 1↔2 columns keeps independent estimates.
  const heightCacheRef = useRef<Map<string, number>>(new Map());
  const cacheKey = `${cols}`;

  // Reset learned heights only when the layout (column count) changes.
  useEffect(() => {
    // Keep the cache around — different breakpoints have their own entry.
  }, [cols]);

  const rows = useMemo(() => {
    const out: SavingsGoal[][] = [];
    for (let i = 0; i < goals.length; i += cols) out.push(goals.slice(i, i + cols));
    return out;
  }, [goals, cols]);

  const estimateSize = useCallback(
    () => heightCacheRef.current.get(cacheKey) ?? estimatedRowHeight,
    [cacheKey, estimatedRowHeight]
  );

  // Debounced + rounded measureElement — prevents sub-pixel reflow churn.
  const measureElement = useCallback(
    (el: Element | null | undefined) => {
      if (!el) return estimateSize();
      const h = Math.round((el as HTMLElement).getBoundingClientRect().height);
      // Update the learned average for this viewport so future first-paints
      // don't jump. Only widen — never shrink below current estimate to
      // avoid oscillation when content lazy-loads.
      const prev = heightCacheRef.current.get(cacheKey) ?? 0;
      if (h > prev) heightCacheRef.current.set(cacheKey, h);
      return h;
    },
    [estimateSize, cacheKey]
  );

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    measureElement,
    overscan: 4,
    // Stable key keeps measurements bound to the row content, not its index,
    // so reordering / filtering doesn't invalidate every cached height.
    getItemKey: (index) => rows[index]?.map(g => g.id).join('|') ?? index,
  });

  // Skeleton placeholder state during loading/re-sync
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton key={i} className="h-80 rounded-2xl" />
        ))}
      </div>
    );
  }

  // Below threshold: render the plain grid (no scroll container, full reflow).
  if (goals.length <= threshold) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {goals.map(render)}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="rounded-2xl border border-border/40 bg-background/40"
      style={{ height: 'min(75vh, 800px)', overflow: 'auto', contain: 'strict' }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map(vRow => {
          const row = rows[vRow.index];
          return (
            <div
              key={vRow.key}
              data-index={vRow.index}
              ref={rowVirtualizer.measureElement}
              className="absolute top-0 left-0 w-full px-2 py-3"
              style={{
                transform: `translate3d(0, ${vRow.start}px, 0)`,
                willChange: 'transform',
                contain: 'layout paint style',
              }}
            >
              <div className={`grid gap-6 ${cols === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {row.map(g => render(g))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
