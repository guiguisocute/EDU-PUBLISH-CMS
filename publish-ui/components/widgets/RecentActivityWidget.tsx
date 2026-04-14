import React from 'react';
import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Article } from '@/types';
import { WidgetDropdown } from './WidgetDropdown';

interface RecentActivityWidgetProps {
  articles: Article[];
  schoolShortNameMap: Record<string, string>;
  onArticleSelect: (article: Article) => void;
}

export const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = React.memo(({
  articles,
  schoolShortNameMap,
  onArticleSelect,
}) => {
  const [selectedSchool, setSelectedSchool] = React.useState<string>('__all__');

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

  const filteredArticles = React.useMemo(() => {
    let list = articles;
    if (selectedSchool !== '__all__') {
      list = list.filter(a => a.schoolSlug === selectedSchool);
    }
    return [...list]
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 8);
  }, [articles, selectedSchool]);

  return (
    <div className="space-y-2.5">
      {/* School filter dropdown */}
      <div className="relative mb-2">
        <WidgetDropdown
          value={selectedSchool}
          options={[{ value: '__all__', label: '全部学院' }, ...schoolOptions.map(o => ({ value: o.slug, label: o.label }))]}
          onChange={setSelectedSchool}
          className="w-full"
        />
      </div>

      {/* Timeline */}
      {filteredArticles.length === 0 ? (
        <p className="text-[11px] text-muted-foreground text-center py-4">暂无最近活动</p>
      ) : (
        <div className="relative ml-3">
          {/* Vertical line */}
          <div className="absolute left-0 top-1 bottom-1 w-px bg-border" />

          <div className="space-y-0">
            {filteredArticles.map((article, idx) => {
              const isFirst = idx === 0;
              const pubDate = new Date(article.pubDate);
              const dateStr = Number.isFinite(pubDate.getTime())
                ? format(pubDate, 'yyyy年M月d日 HH:mm')
                : '';

              return (
                <div key={article.guid} className="relative pl-4 pb-3 last:pb-0">
                  {/* Dot */}
                  <div
                    className={cn(
                      'absolute left-0 top-[3px] -translate-x-1/2 w-2.5 h-2.5 rounded-full',
                      isFirst
                        ? 'bg-primary'
                        : 'border-2 border-muted-foreground bg-card'
                    )}
                  />
                  {/* Content */}
                  <button
                    type="button"
                    onClick={() => onArticleSelect(article)}
                    className="text-left w-full group"
                  >
                    <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {article.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {dateStr}
                    </p>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
RecentActivityWidget.displayName = 'RecentActivityWidget';
