import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WidgetCardProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  onHide?: () => void;
  children: React.ReactNode;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({ id, title, icon, onHide, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-card rounded-xl border shadow-sm overflow-hidden select-none',
        isDragging && 'opacity-50 ring-2 ring-primary z-50'
      )}
    >
      <div className="flex items-center gap-2 p-3 border-b border-border/50 bg-muted/30">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5 rounded touch-none"
          aria-label="拖拽排序"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
        {icon && <span className="text-primary shrink-0">{icon}</span>}
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex-1 truncate">
          {title}
        </span>
        {onHide && (
          <button
            type="button"
            onClick={onHide}
            className="text-muted-foreground hover:text-foreground p-0.5 rounded shrink-0"
            aria-label="隐藏此组件"
          >
            <EyeOff size={13} />
          </button>
        )}
      </div>
      <div className="p-3 bg-[rgb(255,255,255)] dark:bg-[hsl(var(--card))]">
        {children}
      </div>
    </div>
  );
};
