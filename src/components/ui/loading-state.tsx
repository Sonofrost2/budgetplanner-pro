import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface HeaderSkeletonProps {
  className?: string;
}

/** Header skeleton used at the top of dashboard pages while data resolves. */
export const HeaderSkeleton = ({ className }: HeaderSkeletonProps) => (
  <div className={cn('flex items-center justify-between gap-3', className)}>
    <div className="space-y-2">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-3 w-56" />
    </div>
    <Skeleton className="h-9 w-36 rounded-xl" />
  </div>
);

interface GridSkeletonProps {
  count?: number;
  itemClassName?: string;
  columnsClassName?: string;
}

/** Grid of card skeletons — mirrors the standard 2-col dashboard grid. */
export const GridSkeleton = ({
  count = 4,
  itemClassName = 'h-40 rounded-2xl',
  columnsClassName = 'grid-cols-1 md:grid-cols-2',
}: GridSkeletonProps) => (
  <div className={cn('grid gap-4', columnsClassName)}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className={itemClassName} />
    ))}
  </div>
);

interface ListSkeletonProps {
  count?: number;
  itemClassName?: string;
}

/** Vertical list of row skeletons — mirrors transaction/list layouts. */
export const ListSkeleton = ({
  count = 6,
  itemClassName = 'h-14 rounded-xl',
}: ListSkeletonProps) => (
  <div className="space-y-2">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className={itemClassName} />
    ))}
  </div>
);

interface PageSkeletonProps {
  layout?: 'grid' | 'list';
  count?: number;
}

/** Full-page skeleton (header + body) for a coherent loading experience. */
export const PageSkeleton = ({ layout = 'grid', count = 4 }: PageSkeletonProps) => (
  <div className="space-y-6">
    <HeaderSkeleton />
    {layout === 'grid' ? <GridSkeleton count={count} /> : <ListSkeleton count={count} />}
  </div>
);

export default PageSkeleton;