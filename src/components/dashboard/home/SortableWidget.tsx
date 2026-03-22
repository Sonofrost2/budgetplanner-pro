import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { WidgetId } from '@/hooks/useDashboardLayout';
import { WIDGET_LABELS } from '@/hooks/useDashboardLayout';

interface SortableWidgetProps {
  id: WidgetId;
  colSpan: number;
  visible: boolean;
  editMode: boolean;
  locale: string;
  onToggleVisibility: (id: WidgetId) => void;
  children: React.ReactNode;
}

export const SortableWidget = ({
  id, colSpan, visible, editMode, locale, onToggleVisibility, children,
}: SortableWidgetProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editMode });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const label = WIDGET_LABELS[id];
  const isFr = locale === 'fr';

  // Column span classes
  const spanClass = colSpan === 5
    ? 'lg:col-span-5'
    : colSpan === 3
    ? 'lg:col-span-3'
    : 'lg:col-span-2';

  if (!visible && !editMode) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'col-span-1',
        spanClass,
        isDragging && 'opacity-50',
        !visible && editMode && 'opacity-40',
        'relative group/widget',
      )}
    >
      {/* Edit mode overlay */}
      {editMode && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            'absolute inset-0 z-20 rounded-2xl border-2 border-dashed transition-colors pointer-events-none',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-primary/30 hover:border-primary/60',
          )}
        />
      )}

      {/* Drag handle + visibility toggle */}
      {editMode && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1"
        >
          <button
            {...attributes}
            {...listeners}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full glass text-[10px] font-bold text-foreground cursor-grab active:cursor-grabbing shadow-lg border border-primary/20 hover:border-primary/50 transition-colors"
          >
            <GripVertical className="w-3 h-3 text-muted-foreground" />
            <span>{label.icon}</span>
            <span>{isFr ? label.fr : label.en}</span>
          </button>
          <button
            onClick={() => onToggleVisibility(id)}
            className={cn(
              'p-1.5 rounded-full glass shadow-lg border transition-colors',
              visible
                ? 'border-secondary/30 text-secondary hover:bg-secondary/10'
                : 'border-destructive/30 text-destructive hover:bg-destructive/10',
            )}
          >
            {visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          </button>
        </motion.div>
      )}

      {/* Widget content */}
      <div className={cn(
        editMode && 'pt-3',
        !visible && 'pointer-events-none',
      )}>
        {children}
      </div>
    </div>
  );
};
