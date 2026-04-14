import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getTimeWindowState } from '@/lib/time-window';
import type { Article } from '@/types';
import { WidgetDropdown } from './WidgetDropdown';

// Reuse the CountdownBar stripe CSS (already injected by CountdownBar)
const STRIPE_CSS = `
@keyframes cdb-scroll {
  from { background-position: 0 0; }
  to { background-position: 32px 0; }
}
.cdb-stripe-animate {
  animation: cdb-scroll 2s linear infinite !important;
  background-size: 32px 32px !important;
  will-change: width, background-position;
}
`;

let cssInjected = false;
function ensureCSS() {
  if (typeof document === 'undefined' || cssInjected) return;
  // Check if already injected by CountdownBar
  if (document.querySelector('style[data-cdb-stripe]')) {
    cssInjected = true;
    return;
  }
  const tag = document.createElement('style');
  tag.setAttribute('data-cdb-stripe', '');
  tag.textContent = STRIPE_CSS;
  document.head.appendChild(tag);
  cssInjected = true;
}

const GRADIENT = `linear-gradient(45deg,
  hsl(var(--primary)) 25%,
  hsl(var(--primary) / 0.78) 25%,
  hsl(var(--primary) / 0.78) 50%,
  hsl(var(--primary)) 50%,
  hsl(var(--primary)) 75%,
  hsl(var(--primary) / 0.78) 75%,
  hsl(var(--primary) / 0.78) 100%)`;

const DEFAULT_SHOW = 5;

interface ExpiringSoonWidgetProps {
  articles: Article[];
  schoolShortNameMap: Record<string, string>;
  onArticleSelect?: (article: Article) => void;
}

export const ExpiringSoonWidget: React.FC<ExpiringSoonWidgetProps> = React.memo(({ articles, schoolShortNameMap, onArticleSelect }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [nowTs, setNowTs] = React.useState(() => Date.now());
  const [selectedSchool, setSelectedSchool] = React.useState<string>('__all__');

  React.useEffect(ensureCSS, []);

  React.useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const schoolOptions = React.useMemo(() => {
    const slugs = new Set<string>();
    for (const a of articles) {
      if (a.schoolSlug) slugs.add(a.schoolSlug);
    }
    return Array.from(slugs).map(slug => ({
      slug,
      label: schoolShortNameMap[slug] || slug,
    }));
  }, [articles, schoolShortNameMap]);

  const expiringArticles = React.useMemo(() => {
    let list = articles;
    if (selectedSchool !== '__all__') {
      list = list.filter(a => a.schoolSlug === selectedSchool);
    }
    return list
      .filter(a => a.startAt && a.endAt)
      .map(a => {
        const timing = getTimeWindowState(a.startAt, a.endAt, nowTs);
        return { article: a, ...timing };
      })
      .filter(item => item.state === 'active')
      .sort((a, b) => {
        // Most urgent first (highest progress first)
        return b.progress - a.progress;
      });
  }, [articles, nowTs, selectedSchool]);

  const displayList = expanded ? expiringArticles : expiringArticles.slice(0, DEFAULT_SHOW);
  const hasMore = expiringArticles.length > DEFAULT_SHOW;

  if (expiringArticles.length === 0) {
    return (
      <div className="space-y-3">
        <div className="relative mb-2">
          <WidgetDropdown
            value={selectedSchool}
            options={[{ value: '__all__', label: '全部学院' }, ...schoolOptions.map(o => ({ value: o.slug, label: o.label }))]}
            onChange={setSelectedSchool}
            className="w-full"
            align="right"
          />
        </div>
        <p className="text-[11px] text-muted-foreground text-center py-4">
          当前没有即将过期的活动
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* School filter dropdown */}
      <div className="relative mb-2">
        <WidgetDropdown
          value={selectedSchool}
          options={[{ value: '__all__', label: '全部学院' }, ...schoolOptions.map(o => ({ value: o.slug, label: o.label }))]}
          onChange={setSelectedSchool}
          className="w-full"
          align="right"
        />
      </div>

      <div className={expanded ? 'max-h-[300px] overflow-y-auto pr-1 space-y-3 overscroll-contain' : 'space-y-3'}>
        {displayList.map(({ article, progress }) => (
          <div key={article.guid} className="space-y-1">
            <div
              className="flex items-center justify-between gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => onArticleSelect?.(article)}
            >
              <span className="text-xs font-medium text-foreground truncate flex-1" title={article.title}>
                {article.title}
              </span>
              <span className="text-[10px] font-bold text-primary shrink-0">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="relative w-full h-2 rounded-full bg-muted overflow-hidden border border-border/40">
              <div
                className="absolute inset-y-0 left-0 rounded-full cdb-stripe-animate"
                style={{
                  width: `${progress}%`,
                  backgroundImage: GRADIENT,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="flex w-full items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground pt-1"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>收起</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>展开查看更多</span>
            </>
          )}
        </button>
      )}
    </div>
  );
});
ExpiringSoonWidget.displayName = 'ExpiringSoonWidget';
