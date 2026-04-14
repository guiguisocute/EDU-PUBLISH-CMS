import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WidgetDrawerProps {
  side: 'left' | 'right';
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Floating widget panel that overlays on top of the main content area.
 * Anchors to the left or right edge and hovers above the article list.
 */
export const WidgetDrawer: React.FC<WidgetDrawerProps> = ({ side, open, onClose, children }) => {
  const isLeft = side === 'left';

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — only visible on small screens */}
          <motion.div
            className="absolute inset-0 bg-black/20 z-40 lg:bg-black/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          {/* Floating free widgets stack */}
          <motion.div
            className={cn(
              'absolute top-16 z-50 w-72 max-h-[calc(100%-4rem)] overflow-y-auto overscroll-contain flex flex-col',
              isLeft ? 'left-3' : 'right-3'
            )}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340, mass: 0.8 }}
          >
            <div className="flex justify-end mb-2 shrink-0 pr-1">
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground bg-background/60 hover:bg-background/90 backdrop-blur border shadow-sm p-1.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-bold"
                aria-label="关闭全部小组件"
              >
                <X size={14} /> 收起
              </button>
            </div>
            <div className="flex-1 pb-8">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
