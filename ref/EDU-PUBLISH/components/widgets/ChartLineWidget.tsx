import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

import { WidgetDropdown } from './WidgetDropdown';

interface ChartLineWidgetProps {
  articleCountByDate: Record<string, number> | null;
}

export const ChartLineWidget: React.FC<ChartLineWidgetProps> = React.memo(({ articleCountByDate }) => {
  const [granularity, setGranularity] = React.useState('day');

  const data = React.useMemo(() => {
    if (!articleCountByDate) return [];
    const today = new Date();
    const result: Array<{ date: string; count: number }> = [];

    if (granularity === 'day') {
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toDateString(); // matches articleCountByDate key format
        const label = `${d.getMonth() + 1}/${d.getDate()}`;
        result.push({ date: label, count: articleCountByDate[key] || 0 });
      }
    } else if (granularity === 'month') {
      // Aggregate by month
      const countsByMonth = new Map<string, number>();
      for (const [key, count] of Object.entries(articleCountByDate)) {
        const d = new Date(key); // parse toDateString format
        if (isNaN(d.getTime())) continue;
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        countsByMonth.set(monthKey, (countsByMonth.get(monthKey) || 0) + (count as number));
      }
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = `${d.getMonth() + 1}月`;
        result.push({ date: label, count: countsByMonth.get(monthKey) || 0 });
      }
    } else if (granularity === 'year') {
      // Aggregate by year
      const countsByYear = new Map<string, number>();
      for (const [key, count] of Object.entries(articleCountByDate)) {
        const d = new Date(key);
        if (isNaN(d.getTime())) continue;
        const yearKey = String(d.getFullYear());
        countsByYear.set(yearKey, (countsByYear.get(yearKey) || 0) + (count as number));
      }
      for (let i = 4; i >= 0; i--) {
        const year = String(today.getFullYear() - i);
        const label = `${year}年`;
        result.push({ date: label, count: countsByYear.get(year) || 0 });
      }
    }
    return result;
  }, [articleCountByDate, granularity]);

  if (articleCountByDate && Object.keys(articleCountByDate).length === 0) {
    return <p className="text-[11px] text-muted-foreground text-center py-4">暂无数据</p>;
  }

  return (
    <div className="space-y-2">
      <div className="relative mb-2">
        <WidgetDropdown
          value={granularity}
          onChange={setGranularity}
          options={[
            { value: 'day', label: '近14天' },
            { value: 'month', label: '近半年' },
            { value: 'year', label: '近5年' }
          ]}
          align="right"
          className="w-full"
        />
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="widgetAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={10}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#widgetAreaGrad)"
            name="发布数"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});
ChartLineWidget.displayName = 'ChartLineWidget';
