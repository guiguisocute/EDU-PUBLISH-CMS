import React from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { WidgetDef, WidgetId } from '@/hooks/use-widget-config';

interface WidgetAreaProps {
  widgets: WidgetDef[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onHide: (id: WidgetId) => void;
  renderWidget: (id: WidgetId) => React.ReactNode;
}

export const WidgetArea: React.FC<WidgetAreaProps> = React.memo(({
  widgets,
  onReorder,
  onHide,
  renderWidget,
}) => {
  const visibleWidgets = widgets.filter(w => w.visible);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = visibleWidgets.findIndex(w => w.id === active.id);
    const toIndex = visibleWidgets.findIndex(w => w.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;

    // Map visible indices back to full list indices
    const fullFrom = widgets.indexOf(visibleWidgets[fromIndex]);
    const fullTo = widgets.indexOf(visibleWidgets[toIndex]);
    onReorder(fullFrom, fullTo);
  }, [widgets, visibleWidgets, onReorder]);

  if (visibleWidgets.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={visibleWidgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3 p-3">
          {visibleWidgets.map(w => renderWidget(w.id))}
        </div>
      </SortableContext>
    </DndContext>
  );
});
WidgetArea.displayName = 'WidgetArea';
