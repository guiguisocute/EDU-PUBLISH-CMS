import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

interface ChartBarWidgetProps {
  tagStats: Array<{ tag: string; count: number }>;
}

export const ChartBarWidget: React.FC<ChartBarWidgetProps> = React.memo(({ tagStats }) => {
  const data = React.useMemo(() => tagStats.slice(0, 6), [tagStats]);

  if (data.length === 0) {
    return <p className="text-[11px] text-muted-foreground text-center py-4">暂无数据</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
        <XAxis
          type="number"
          hide
          allowDecimals={false}
        />
        <YAxis
          dataKey="tag"
          type="category"
          width={56}
          tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 11,
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
          }}
        />
        <Bar
          dataKey="count"
          fill="hsl(var(--primary))"
          radius={[0, 4, 4, 0]}
          name="数量"
        />
      </BarChart>
    </ResponsiveContainer>
  );
});
ChartBarWidget.displayName = 'ChartBarWidget';
