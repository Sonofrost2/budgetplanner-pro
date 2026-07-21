import { useMemo, useState } from 'react';
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
} from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, ChevronRight, GripVertical, FolderTree, Archive, RotateCcw } from 'lucide-react';
import type { Category } from '@/hooks/useDashboardData';
import type { CategoryStats } from '@/lib/categoryAnalytics';
import { normalizeSparkline } from '@/lib/categoryAnalytics';
import { CategorySparkline } from './CategorySparkline';

interface Props {
  categories: Category[];
  stats: Record<string, CategoryStats>;
  txCounts: Record<string, number>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onEdit: (cat: Category) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onReparent: (childId: string, newParentId: string | null) => void;
  isFr: boolean;
}

export const CategoryTreeView = ({
  categories, stats, txCounts, selectedIds, onToggleSelect, onEdit, onDelete, onArchive, onReparent, isFr,
}: Props) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = useMemo(() => {
    const roots = categories.filter(c => !c.parent_category_id);
    const childrenMap: Record<string, Category[]> = {};
    categories.forEach(c => {
      if (c.parent_category_id) {
        (childrenMap[c.parent_category_id] ||= []).push(c);
      }
    });
    // Sort children alphabetically for stable display
    Object.values(childrenMap).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));
    return { roots, childrenMap };
  }, [categories]);

  const familyRootId = useMemo(
    () => categories.find((c: any) => c.is_family_root)?.id ?? null,
    [categories]
  );

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const childId = String(active.id);
    const dropId = String(over.id);
    if (dropId === '__root__') return onReparent(childId, null);
    if (childId === dropId) return;
    onReparent(childId, dropId);
  };

  if (tree.roots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
        <FolderTree className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">{isFr ? 'Aucune catégorie dans cette section' : 'No categories in this section'}</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <RootDropZone isFr={isFr} />
      <div className="space-y-2 mt-2">
        {tree.roots.map(root => (
          <CategoryNode
            key={root.id}
            category={root}
            depth={1}
            childrenMap={tree.childrenMap}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            stats={stats}
            txCounts={txCounts}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onEdit={onEdit}
            onDelete={onDelete}
            onArchive={onArchive}
            isFr={isFr}
            familyRootId={familyRootId}
          />
        ))}
      </div>
    </DndContext>
  );
};

const RootDropZone = ({ isFr }: { isFr: boolean }) => {
  const { setNodeRef, isOver } = useDroppable({ id: '__root__' });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-dashed p-2 text-center text-[11px] transition-colors ${isOver ? 'border-primary bg-primary/10 text-primary' : 'border-border/40 text-muted-foreground/60'}`}
    >
      {isFr ? '⇧ Déposer ici pour mettre à la racine' : '⇧ Drop here to move to root'}
    </div>
  );
};

interface NodeProps {
  category: Category;
  depth: number;
  childrenMap: Record<string, Category[]>;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  stats: Record<string, CategoryStats>;
  txCounts: Record<string, number>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onEdit: (c: Category) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  isFr: boolean;
  familyRootId?: string | null;
}

const CategoryNode = ({
  category, depth, childrenMap, expanded, onToggleExpand, stats, txCounts, selectedIds, onToggleSelect, onEdit, onDelete, onArchive, isFr, familyRootId,
}: NodeProps) => {
  const isSelected = selectedIds.has(category.id);
  const stat = stats[category.id];
  const series = normalizeSparkline(stat?.monthly_series ?? []);
  const txCount = txCounts[category.id] || 0;
  const childrenCats = childrenMap[category.id] ?? [];
  const hasChildren = childrenCats.length > 0;
  const isExpanded = expanded.has(category.id);
  const isFamilyRoot = (category as any).is_family_root === true;
  const isSharedChild = !!familyRootId && category.parent_category_id === familyRootId;

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: category.id });
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: category.id });

  return (
    <div>
      <Card
        ref={setDropRef}
        className={`group rounded-2xl transition-all ${isSelected ? 'ring-2 ring-primary/40' : ''} ${isOver ? 'ring-2 ring-primary bg-primary/5' : ''} ${isDragging ? 'opacity-40' : ''}`}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button
            ref={setDragRef}
            {...attributes}
            {...listeners}
            className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
            aria-label="Drag"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(category.id)} />

          {hasChildren ? (
            <button onClick={() => onToggleExpand(category.id)} className="text-muted-foreground hover:text-foreground transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : <span className="w-4" />}

          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: category.color + '22' }}>
            {category.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm truncate">{category.name}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/30 font-medium">
                N{depth}
              </span>
              {isFamilyRoot && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/20 font-semibold flex items-center gap-0.5">
                  👨‍👩‍👧 {isFr ? 'Racine Famille' : 'Family root'}
                </span>
              )}
              {isSharedChild && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/20 font-semibold">
                  {isFr ? 'Partageable' : 'Shareable'}
                </span>
              )}
              {hasChildren && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                  {childrenCats.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {txCount > 0 ? `${txCount} tx` : (isFr ? 'Aucune tx' : 'No tx')}
            </p>
          </div>

          <CategorySparkline values={series} color={category.color} className="hidden sm:flex" />

          <div className="flex gap-1">
            <Button aria-label="Modifier" variant="ghost" size="icon" className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onEdit(category)} title={isFr ? 'Modifier' : 'Edit'}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            {onArchive && (
              <Button aria-label="Action" variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-warning opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onArchive(category.id)} title={isFr ? 'Archiver' : 'Archive'}>
                <Archive className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button aria-label="Supprimer" variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onDelete(category.id)} title={isFr ? 'Supprimer' : 'Delete'}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {isExpanded && hasChildren && (
        <div className="ml-7 mt-1.5 space-y-1.5 pl-3 border-l border-border/40">
          {childrenCats.map(child => (
            <CategoryNode
              key={child.id}
              category={child}
              depth={depth + 1}
              childrenMap={childrenMap}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              stats={stats}
              txCounts={txCounts}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              onArchive={onArchive}
              isFr={isFr}
              familyRootId={familyRootId}
            />
          ))}
        </div>
      )}
    </div>
  );
};
