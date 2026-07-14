import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  /** Optional slot rendered below the title/actions row (badges, filters, tabs...) */
  children?: ReactNode;
  /** As-child heading level. Defaults to h1. Use h2 when nested under another PageHeader. */
  as?: 'h1' | 'h2';
  className?: string;
  /** Compact mode reduces vertical rhythm — useful in dialogs or nested panels. */
  compact?: boolean;
}

/**
 * Unified page/section header used across dashboard pages.
 * Ensures consistent typography (Space Grotesk display, tracking-tight),
 * spacing, and title/description/actions layout.
 */
export const PageHeader = ({
  title,
  description,
  icon: Icon,
  actions,
  children,
  as = 'h1',
  className,
  compact = false,
}: PageHeaderProps) => {
  const Heading = as;
  return (
    <header className={cn(compact ? 'space-y-2' : 'space-y-3', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0" aria-hidden>
                <Icon className="w-5 h-5" />
              </div>
            )}
            <Heading
              className={cn(
                'font-display font-bold tracking-tight text-foreground truncate',
                compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl',
              )}
            >
              {title}
            </Heading>
          </div>
          {description && (
            <p className={cn('text-muted-foreground', compact ? 'text-xs mt-1' : 'text-sm mt-1.5', Icon ? 'sm:pl-[52px]' : '')}>
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
      {children}
    </header>
  );
};

export default PageHeader;