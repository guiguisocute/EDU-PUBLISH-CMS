import React from 'react';
import { Settings2, RotateCcw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { WidgetDef, WidgetId } from '@/hooks/use-widget-config';
import { cn } from '@/lib/utils';

const WIDGET_LABELS: Record<WidgetId, string> = {
  'recent-activity': '最近活动',
  'expiring-soon': '即将过期',
  'chart-line': '折线图（趋势）',
  'chart-pie': '饼图（占比）',
  'chart-bar': '柱状图（统计）',
};

interface WidgetConfigPanelProps {
  widgets: WidgetDef[];
  onToggle: (id: WidgetId) => void;
  onReset: () => void;
}

export const WidgetConfigPanel: React.FC<WidgetConfigPanelProps> = ({ widgets, onToggle, onReset }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="px-3 pb-3">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-lg border transition-colors bg-card',
          open
            ? 'text-primary border-primary/30'
            : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
        )}
      >
        <Settings2 size={13} />
        <span>管理小组件</span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="p-2.5 space-y-1">
            {widgets.map(w => (
              <label
                key={w.id}
                className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded hover:bg-muted/40 cursor-pointer"
              >
                <span className={cn('font-medium', w.visible ? 'text-foreground' : 'text-muted-foreground')}>
                  {WIDGET_LABELS[w.id] || w.id}
                </span>
                <Switch
                  checked={w.visible}
                  onCheckedChange={() => onToggle(w.id)}
                  aria-label={`${w.visible ? '隐藏' : '显示'} ${WIDGET_LABELS[w.id]}`}
                />
              </label>
            ))}
          </div>
          <div className="border-t p-2.5 flex justify-center">
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw size={12} />
              <span>恢复默认</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
