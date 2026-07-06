'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

// Categorical slots 1 (blue) & 2 (aqua) from the validated reference palette —
// this app has no site-wide dark theme, so only the light-surface values are used.
const COLOR_ADDED = '#2a78d6';
const COLOR_COMPLETED = '#1baf7a';
const INK_SECONDARY = '#52514e';
const GRIDLINE = '#e1e0d9';

function formatBucketLabel(bucket, granularity) {
  if (granularity === 'year') return bucket;
  if (granularity === 'month') {
    const [y, m] = bucket.split('-');
    const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  const [y, m, day] = bucket.split('-');
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, Number(day)));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-sm shadow-sm">
      <div className="mb-1 font-semibold text-foreground">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block h-0.5 w-4" style={{ background: entry.color }} />
          <span>{entry.name}</span>
          <strong className="ml-auto text-foreground">{entry.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsChart({ series, granularity }) {
  const data = useMemo(
    () => series.map((s) => ({ ...s, label: formatBucketLabel(s.bucket, granularity) })),
    [series, granularity]
  );

  // Thin x-axis labels so they don't collide — aim for ~7 visible labels.
  const tickInterval = Math.max(0, Math.ceil(data.length / 7) - 1);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid stroke={GRIDLINE} vertical={false} />
        <XAxis
          dataKey="label"
          interval={tickInterval}
          tick={{ fontSize: 11, fill: INK_SECONDARY }}
          tickLine={false}
          axisLine={{ stroke: GRIDLINE }}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: INK_SECONDARY }} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Legend
          verticalAlign="top"
          align="left"
          height={32}
          iconType="plainline"
          wrapperStyle={{ fontSize: 13, color: INK_SECONDARY }}
        />
        <Line type="monotone" dataKey="added" name="Cases Added" stroke={COLOR_ADDED} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="completed" name="Cases Completed" stroke={COLOR_COMPLETED} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
