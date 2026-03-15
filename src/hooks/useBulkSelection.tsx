import { useState, useCallback, useMemo } from 'react';

export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds(prev => {
      const allSelected = items.length > 0 && items.every(i => prev.has(i.id));
      if (allSelected) {
        const next = new Set(prev);
        items.forEach(i => next.delete(i.id));
        return next;
      }
      const next = new Set(prev);
      items.forEach(i => next.add(i.id));
      return next;
    });
  }, [items]);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const isAllSelected = useMemo(() => items.length > 0 && items.every(i => selectedIds.has(i.id)), [items, selectedIds]);
  const hasSelection = selectedIds.size > 0;
  const count = selectedIds.size;
  const selectedItems = useMemo(() => items.filter(i => selectedIds.has(i.id)), [items, selectedIds]);

  return { selectedIds, toggle, toggleAll, clear, isAllSelected, hasSelection, count, selectedItems, setSelectedIds };
}
