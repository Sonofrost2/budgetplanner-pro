import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useIsMobile } from '@/hooks/use-mobile';
import type { SavingsGoal } from '@/hooks/useDashboardData';

interface Props {
  goals: SavingsGoal[];
  render: (g: SavingsGoal) => React.ReactNode;
  /** Threshold above which we switch to virtualization. */
  threshold?: number;
  /** Estimated card height in px (used for windowing math). */
  estimatedRowHeight?: number;
}

/**
 * Renders a responsive 1/2-column grid of savings goals.
 * - Below `threshold` (default 30 items): falls back to a plain CSS grid
 *   so SEO/print/screen-reader behavior matches the legacy view.
 * - Above the threshold: virtualizes by *row* (1 col mobile, 2 col desktop)
 *   using @tanstack/react-virtual to keep DOM nodes ~constant.
 */
export const VirtualizedGoalsGrid = ({
  goals,
  render,
  threshold = 30,
  estimatedRowHeight = 360,
}: Props) => {
  const isMobile = useIsMobile();
  const cols = isMobile ? 1 : 2;
  const parentRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo(() => {
    const out: SavingsGoal[][] = [];
    for (let i = 0; i < goals.length; i += cols) out.push(goals.slice(i, i + cols));
    return out;
  }, [goals, cols]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 4,
  });

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
              style={{ transform: `translateY(${vRow.start}px)` }}
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