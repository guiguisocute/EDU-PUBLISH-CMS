import React from 'react';

export type WidgetId =
  | 'recent-activity'
  | 'expiring-soon'
  | 'chart-line'
  | 'chart-pie'
  | 'chart-bar';

export interface WidgetDef {
  id: WidgetId;
  side: 'left' | 'right';
  visible: boolean;
}

const DEFAULTS: WidgetDef[] = [
  { id: 'recent-activity', side: 'left',  visible: true },
  { id: 'expiring-soon',   side: 'left',  visible: true },
  { id: 'chart-line',      side: 'right', visible: true },
  { id: 'chart-pie',       side: 'right', visible: true },
  { id: 'chart-bar',       side: 'right', visible: true },
];

const STORAGE_KEY = 'widget-config-v1';

function loadConfig(): WidgetDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as WidgetDef[];
    // Merge any new defaults not present in saved config
    const savedIds = new Set(parsed.map(w => w.id));
    const merged = [...parsed];
    for (const def of DEFAULTS) {
      if (!savedIds.has(def.id)) merged.push(def);
    }
    return merged;
  } catch {
    return DEFAULTS;
  }
}

function persist(widgets: WidgetDef[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  } catch { /* quota exceeded — ignore */ }
}

export function useWidgetConfig() {
  const [widgets, setWidgets] = React.useState<WidgetDef[]>(loadConfig);

  const toggleVisible = React.useCallback((id: WidgetId) => {
    setWidgets(prev => {
      const next = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
      persist(next);
      return next;
    });
  }, []);

  const reorder = React.useCallback((side: 'left' | 'right', fromIndex: number, toIndex: number) => {
    setWidgets(prev => {
      const sideItems = prev.filter(w => w.side === side);
      const others = prev.filter(w => w.side !== side);
      const [moved] = sideItems.splice(fromIndex, 1);
      sideItems.splice(toIndex, 0, moved);
      const next = side === 'left' ? [...sideItems, ...others] : [...others, ...sideItems];
      persist(next);
      return next;
    });
  }, []);

  const resetToDefaults = React.useCallback(() => {
    setWidgets(DEFAULTS);
    persist(DEFAULTS);
  }, []);

  const leftWidgets = React.useMemo(() => widgets.filter(w => w.side === 'left'), [widgets]);
  const rightWidgets = React.useMemo(() => widgets.filter(w => w.side === 'right'), [widgets]);

  return { leftWidgets, rightWidgets, toggleVisible, reorder, resetToDefaults };
}
