import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DropdownOption {
  value: string;
  label: string;
}

interface WidgetDropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  className?: string;
  align?: 'left' | 'right';
  placeholder?: string;
}

export const WidgetDropdown: React.FC<WidgetDropdownProps> = ({
  value,
  options,
  onChange,
  className,
  align = 'right',
  placeholder
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("relative inline-block", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-bold transition-colors select-none w-full justify-between",
          isOpen
            ? "bg-primary text-primary-foreground"
            : "bg-muted/50 text-foreground hover:bg-muted"
        )}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 shrink-0 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/5 md:bg-transparent"
              onClick={() => setIsOpen(false)}
            />
            {/* Dropdown menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={cn(
                "absolute top-[calc(100%+6px)] z-50 min-w-36 max-h-64 overflow-y-auto overflow-x-hidden rounded-xl border bg-card text-card-foreground shadow-lg custom-scrollbar",
                align === 'right' ? 'right-0' : 'left-0'
              )}
            >
              <div className="p-1 flex flex-col gap-0.5">
                {options.map((opt) => {
                  const isSelected = value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between w-full px-3 py-2 text-xs font-bold rounded-lg transition-colors text-left",
                        isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      )}
                    >
                      <span className="truncate mr-2">{opt.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
