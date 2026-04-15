import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import type { DraftWorkspaceDiagnostics } from '../../hooks/use-draft-workspace';

export interface DevDiagnosticsProps {
  diagnostics: DraftWorkspaceDiagnostics;
}

export function DevDiagnostics({ diagnostics }: DevDiagnosticsProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const constraintsRef = useRef(null);

  return (
    <>
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-[998]" />
      <motion.aside 
        drag
        dragConstraints={constraintsRef}
        dragMomentum={false}
        className="fixed bottom-4 left-4 min-w-[240px] max-w-xs bg-black/80 text-white text-xs rounded-xl z-[999] shadow-2xl backdrop-blur-sm shadow-black/50 pointer-events-auto border border-white/10 overflow-hidden flex flex-col" 
        aria-label="Developer diagnostics"
      >
        <div className="flex items-center justify-between p-2.5 bg-black/40 border-b border-white/10 cursor-grab active:cursor-grabbing hover:bg-black/60 transition-colors" data-drag-handle>
          <div className="flex items-center gap-2">
             <GripHorizontal className="w-3.5 h-3.5 opacity-50" />
             <h3 className="font-bold text-primary uppercase tracking-wider text-[11px]">开发诊断信息</h3>
          </div>
          <button 
            type="button"
            className="p-1 hover:bg-white/20 text-white rounded transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
            aria-label={isCollapsed ? "展开诊断信息" : "折叠诊断信息"}
          >
            {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-4">
                <div className="col-span-2 flex justify-between border-b border-white/20 pb-1">
                  <dt className="opacity-70">选中的卡片 (Selected Card)</dt>
                  <dd className="font-mono text-[10px] break-all text-right max-w-[200px] truncate">{diagnostics.selectedCardId || '无'}</dd>
                </div>
                <div className="flex justify-between border-b border-white/20 pb-1">
                  <dt className="opacity-70">脏文件数 (Dirty Files)</dt>
                  <dd className="font-bold text-amber-400">{diagnostics.dirtyCount}</dd>
                </div>
                <div className="flex justify-between border-b border-white/20 pb-1">
                  <dt className="opacity-70">验证问题 (Issues)</dt>
                  <dd className={`font-bold ${diagnostics.validationIssueCount > 0 ? 'text-destructive' : 'text-emerald-400'}`}>
                    {diagnostics.validationIssueCount}
                  </dd>
                </div>
                <div className="col-span-2 flex justify-between border-b border-white/20 pb-1">
                  <dt className="opacity-70">基头提交 (Base SHA)</dt>
                  <dd className="font-mono text-[10px] opacity-80">{diagnostics.baseHeadSha?.slice(0, 8) || '未加载'}</dd>
                </div>
                <div className="col-span-2 flex justify-between pt-1">
                  <dt className="opacity-70">编译耗时 (Compile)</dt>
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
