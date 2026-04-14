import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(173, 58%, 39%)',
  'hsl(12, 76%, 61%)',
  'hsl(43, 74%, 66%)',
  'hsl(27, 87%, 67%)',
  'hsl(var(--muted-foreground))',
];

interface ChartPieWidgetProps {
  categoryStats: Array<{ category: string; count: number }>;
}

export const ChartPieWidget: React.FC<ChartPieWidgetProps> = React.memo(({ categoryStats }) => {
  if (categoryStats.length === 0) {
    return <p className="text-[11px] text-muted-foreground text-center py-4">暂无数据</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={categoryStats}
          dataKey="count"
          nameKey="category"
          cx="50%"
          cy="45%"
          innerRadius={25}
          outerRadius={50}
          paddingAngle={2}
          stroke="hsl(var(--card))"
          strokeWidth={1}
        >
          {categoryStats.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            fontSize: 11,
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            color: 'hsl(var(--foreground))',
            boxShadow: '0 8px 24px hsl(var(--foreground) / 0.15)',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}
          itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
          formatter={(value: any) => [`${value ?? 0}`, '数量']}
        />
        <Legend
          wrapperStyle={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}
          iconSize={8}
          formatter={(value: string) => (
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
});
ChartPieWidget.displayName = 'ChartPieWidget';
