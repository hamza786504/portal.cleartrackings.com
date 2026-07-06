'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BsBarChartLine,
  BsCalendarRange,
  BsFiles,
  BsClockHistory,
  BsArrowRepeat,
  BsHourglassSplit,
  BsCheckCircle,
} from 'react-icons/bs';
import DashboardShell from '@/app/_components/admin/DashboardShell';
import AnalyticsChart from '@/app/_components/admin/AnalyticsChart';
import StatCard from '@/app/_components/shared/StatCard';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Button } from '@/app/_components/ui/button';
import { Input } from '@/app/_components/ui/input';
import { Label } from '@/app/_components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/_components/ui/select';
import { Alert, AlertDescription } from '@/app/_components/ui/alert';
import Spinner from '@/app/_components/shared/Spinner';
import { cn } from '@/app/lib/utils';

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function presetRange(key) {
  const today = new Date();
  const to = toISODate(today);
  switch (key) {
    case '7d': {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from: toISODate(from), to, granularity: 'day' };
    }
    case '30d': {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from: toISODate(from), to, granularity: 'day' };
    }
    case '90d': {
      const from = new Date(today);
      from.setDate(from.getDate() - 89);
      return { from: toISODate(from), to, granularity: 'day' };
    }
    case 'month': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toISODate(from), to, granularity: 'day' };
    }
    case '12m': {
      const from = new Date(today);
      from.setMonth(from.getMonth() - 11);
      from.setDate(1);
      return { from: toISODate(from), to, granularity: 'month' };
    }
    case 'year': {
      const from = new Date(today.getFullYear(), 0, 1);
      return { from: toISODate(from), to, granularity: 'month' };
    }
    default:
      return presetRange('30d');
  }
}

const PRESETS = [
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
  { key: 'month', label: 'This Month' },
  { key: '12m', label: 'Last 12 Months' },
  { key: 'year', label: 'This Year' },
];

export default function AdminAnalyticsPage() {
  const [activePreset, setActivePreset] = useState('30d');
  const [range, setRange] = useState(() => presetRange('30d'));
  const [customOpen, setCustomOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchAnalytics = async (r) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ from: r.from, to: r.to, granularity: r.granularity });
      const res = await fetch(`/api/admin/analytics?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load analytics');
      setData(json);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const applyPreset = (key) => {
    setActivePreset(key);
    setCustomOpen(false);
    setRange(presetRange(key));
  };

  const applyCustom = () => {
    setActivePreset(null);
    fetchAnalytics(range);
  };

  const totals = data?.totals || { pending: 0, 'in-progress': 0, delivered: 0, completed: 0, total: 0 };
  const series = data?.series || [];

  const rangeAddedTotal = useMemo(() => series.reduce((sum, s) => sum + s.added, 0), [series]);
  const rangeCompletedTotal = useMemo(() => series.reduce((sum, s) => sum + s.completed, 0), [series]);

  const statCards = [
    { label: 'Total Cases (all time)', value: totals.total, icon: BsFiles, iconClassName: 'text-foreground', iconBgClassName: 'bg-muted' },
    { label: 'Pending Now', value: totals.pending, icon: BsClockHistory, iconClassName: 'text-warning', iconBgClassName: 'bg-warning/15' },
    { label: 'In Progress Now', value: totals['in-progress'], icon: BsArrowRepeat, iconClassName: 'text-primary', iconBgClassName: 'bg-primary/10' },
    { label: 'Awaiting Approval', value: totals.delivered, icon: BsHourglassSplit, iconClassName: 'text-info', iconBgClassName: 'bg-info/15' },
    { label: 'Completed Now', value: totals.completed, icon: BsCheckCircle, iconClassName: 'text-success', iconBgClassName: 'bg-success/15' },
  ];

  return (
    <DashboardShell>
      <div className="mb-4">
        <h4 className="mb-1 flex items-center gap-2 text-xl font-bold">
          <BsBarChartLine /> Analytics
        </h4>
        <p className="mb-0 text-sm text-muted-foreground">Cases added and completed over time</p>
      </div>

      {/* Filters — one row, above the charts */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={activePreset === p.key ? 'default' : 'outline'}
            className={cn(activePreset === p.key && 'bg-foreground text-background hover:bg-foreground/90')}
            onClick={() => applyPreset(p.key)}
          >
            {p.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant={customOpen ? 'default' : 'outline'}
          className={cn('gap-1', customOpen && 'bg-foreground text-background hover:bg-foreground/90')}
          onClick={() => setCustomOpen((v) => !v)}
        >
          <BsCalendarRange /> Custom
        </Button>
      </div>

      {customOpen && (
        <Card className="mb-4 border-0 shadow-sm">
          <CardContent className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="mb-1 text-sm text-muted-foreground">From</Label>
              <Input
                type="date"
                className="h-8"
                value={range.from}
                max={range.to}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 text-sm text-muted-foreground">To</Label>
              <Input
                type="date"
                className="h-8"
                value={range.to}
                min={range.from}
                max={toISODate(new Date())}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 text-sm text-muted-foreground">Granularity</Label>
              <Select value={range.granularity} onValueChange={(value) => setRange((r) => ({ ...r, granularity: value }))}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Daily</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90" onClick={applyCustom}>
              Apply
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stat tiles — current snapshot, not date-bound */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} loading={loading} />
        ))}
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h6 className="mb-0 font-bold">Cases Added vs Completed</h6>
            {!loading && !errorMsg && (
              <span className="text-sm text-muted-foreground">
                {rangeAddedTotal} added · {rangeCompletedTotal} completed in this range
              </span>
            )}
          </div>

          {errorMsg ? (
            <Alert variant="destructive" className="mb-0">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          ) : loading ? (
            <div className="flex items-center justify-center py-5">
              <Spinner className="size-8" />
            </div>
          ) : series.length === 0 ? (
            <div className="py-5 text-center text-muted-foreground">No case activity in this range.</div>
          ) : (
            <AnalyticsChart series={series} granularity={data.range.granularity} />
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
