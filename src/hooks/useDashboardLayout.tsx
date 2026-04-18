import { useState, useCallback } from 'react';

export type WidgetId = 'planner' | 'accounts' | 'charts' | 'budgets' | 'savings' | 'forecast' | 'transactions' | 'wealth' | 'health';

export interface WidgetConfig {
  id: WidgetId;
  colSpan: number; // out of 5 columns on desktop
  visible: boolean;
}

const DEFAULT_ORDER: WidgetConfig[] = [
  { id: 'planner', colSpan: 3, visible: true },
  { id: 'accounts', colSpan: 2, visible: true },
  { id: 'charts', colSpan: 3, visible: true },
  { id: 'budgets', colSpan: 2, visible: true },
  { id: 'forecast', colSpan: 3, visible: true },
  { id: 'savings', colSpan: 2, visible: true },
  { id: 'wealth', colSpan: 2, visible: true },
  { id: 'health', colSpan: 3, visible: true },
  { id: 'transactions', colSpan: 5, visible: true },
];

const STORAGE_KEY = 'dashboard-widget-layout';

function loadLayout(): WidgetConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const saved: WidgetConfig[] = JSON.parse(raw);
    // Ensure all default widgets exist (in case new ones were added)
    const ids = new Set(saved.map(w => w.id));
    const merged = [...saved];
    DEFAULT_ORDER.forEach(d => {
      if (!ids.has(d.id)) merged.push(d);
    });
    return merged;
  } catch {
    return DEFAULT_ORDER;
  }
}

function saveLayout(layout: WidgetConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function useDashboardLayout() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(loadLayout);
  const [editMode, setEditMode] = useState(false);

  const reorder = useCallback((oldIndex: number, newIndex: number) => {
    setWidgets(prev => {
      const next = [...prev];
      const [removed] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, removed);
      saveLayout(next);
      return next;
    });
  }, []);

  const toggleVisibility = useCallback((id: WidgetId) => {
    setWidgets(prev => {
      const next = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
      saveLayout(next);
      return next;
    });
  }, []);

  const resetLayout = useCallback(() => {
    setWidgets(DEFAULT_ORDER);
    saveLayout(DEFAULT_ORDER);
  }, []);

  const updateWidgets = useCallback((newWidgets: WidgetConfig[]) => {
    setWidgets(newWidgets);
    saveLayout(newWidgets);
  }, []);

  return {
    widgets,
    editMode,
    setEditMode,
    reorder,
    toggleVisibility,
    resetLayout,
    updateWidgets,
  };
}

export const WIDGET_LABELS: Record<WidgetId, { fr: string; en: string; icon: string }> = {
  planner: { fr: 'Planificateur', en: 'Weekly Planner', icon: '📅' },
  accounts: { fr: 'Comptes', en: 'Accounts', icon: '🏦' },
  charts: { fr: 'Graphiques', en: 'Charts', icon: '📊' },
  budgets: { fr: 'Budgets', en: 'Budgets', icon: '💰' },
  savings: { fr: 'Épargne', en: 'Savings', icon: '🎯' },
  forecast: { fr: 'Prévisions', en: 'Forecast', icon: '📈' },
  wealth: { fr: 'Patrimoine', en: 'Wealth', icon: '💎' },
  health: { fr: 'Santé financière', en: 'Financial health', icon: '❤️' },
  transactions: { fr: 'Transactions', en: 'Transactions', icon: '🔄' },
};
