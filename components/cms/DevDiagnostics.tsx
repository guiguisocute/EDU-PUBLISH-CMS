import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripHorizontal, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { DraftWorkspaceDiagnostics } from '../../hooks/use-draft-workspace';

export interface DevDiagnosticsProps {
  diagnostics: DraftWorkspaceDiagnostics;
}

export function DevDiagnostics({ diagnostics }: DevDiagnosticsProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const constraintsRef = useRef(null);

  if (!isVisible) return null;

  return (
    <>
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-[998]" />
      <motion.aside 
        drag
        dragConstraints={constraintsRef}
        dragMomentum={false}
        className="fixed bottom-4 left-4 min-w-[240px] max-w-xs bg-card/95 text-card-foreground text-xs rounded-xl z-[999] shadow-2xl backdrop-blur-sm pointer-events-auto border overflow-hidden flex flex-col" 
        aria-label="Developer diagnostics"
      >
        <div className="flex items-center justify-between p-2.5 bg-muted/60 border-b cursor-grab active:cursor-grabbing hover:bg-muted/80 transition-colors" data-drag-handle>
          <div className="flex items-center gap-2">
             <GripHorizontal className="w-3.5 h-3.5 opacity-50" />
             <h3 className="font-bold tracking-wider text-[11px]">开发诊断信息</h3>
          </div>
          <div className="flex items-center gap-1">
            <button 
              type="button"
              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(!isCollapsed);
              }}
              aria-label={isCollapsed ? "展开诊断信息" : "折叠诊断信息"}
            >
              {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button 
              type="button"
              className="p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(false);
              }}
              aria-label="关闭诊断信息"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 bg-background/50">
                <div className="col-span-2 flex justify-between border-b pb-1">
                  <dt className="text-muted-foreground">选中的卡片</dt>
                  <dd className="font-mono text-[10px] break-all text-right max-w-[200px] truncate">{diagnostics.selectedCardId || '无'}</dd>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <dt className="text-muted-foreground">脏文件数</dt>
                  <dd className="font-bold text-amber-600 dark:text-amber-500">{diagnostics.dirtyCount}</dd>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <dt className="text-muted-foreground">验证问题</dt>
                  <dd className={`font-bold ${diagnostics.validationIssueCount > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-500'}`}>
                    {diagnostics.validationIssueCount}
                  </dd>
                </div>
                <div className="col-span-2 flex justify-between border-b pb-1">
                  <dt className="text-muted-foreground">基头提交</dt>
                  <dd className="font-mono text-[10px] opacity-80">{diagnostics.baseHeadSha?.slice(0, 8) || '未加载'}</dd>
                </div>
                <div className="col-span-2 flex justify-between pt-1">
                  <dt className="text-muted-foreground">编译耗时</dt>
                  <dd className="font-mono">{diagnostics.compileDurationMs.toFixed(2)} ms</dd>
                </div>
              </dl>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </>
  );
}
