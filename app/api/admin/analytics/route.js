import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';

const DAY_MS = 24 * 60 * 60 * 1000;

function bucketKey(date, granularity) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  if (granularity === 'year') return `${y}`;
  if (granularity === 'month') return `${y}-${m}`;
  return `${y}-${m}-${d}`;
}

function stepDate(date, granularity) {
  const next = new Date(date);
  if (granularity === 'year') next.setUTCFullYear(next.getUTCFullYear() + 1);
  else if (granularity === 'month') next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

// Full list of bucket keys spanning [from, to] so the chart has a
// continuous x-axis even where a day/month/year had zero cases.
function buildBuckets(from, to, granularity) {
  const buckets = [];
  let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const max = 400; // safety cap
  while (cursor <= to && buckets.length < max) {
    buckets.push(bucketKey(cursor, granularity));
    cursor = stepDate(cursor, granularity);
  }
  return buckets;
}

/**
 * GET /api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|month|year
 * Admin: time-bucketed counts of cases added and completed within the range,
 * plus a current (unbounded) snapshot of status totals.
 */
export async function GET(req) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const granularity = ['day', 'month', 'year'].includes(searchParams.get('granularity'))
      ? searchParams.get('granularity')
      : 'day';

    const now = new Date();
    const defaultTo = now;
    const defaultFrom = new Date(now.getTime() - 29 * DAY_MS);

    const from = searchParams.get('from') ? new Date(searchParams.get('from')) : defaultFrom;
    const to = searchParams.get('to') ? new Date(searchParams.get('to')) : defaultTo;

    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      return NextResponse.json({ message: 'Invalid date range' }, { status: 400 });
    }

    // Inclusive end-of-day boundary
    const toInclusive = new Date(to.getTime() + DAY_MS - 1);

    const [addedCases, completedCases, statusTotals] = await Promise.all([
      prisma.case.findMany({
        where: { createdAt: { gte: from, lte: toInclusive } },
        select: { createdAt: true },
      }),
      prisma.case.findMany({
        where: { status: 'completed', deliveredAt: { gte: from, lte: toInclusive } },
        select: { deliveredAt: true },
      }),
      prisma.case.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    const buckets = buildBuckets(from, toInclusive, granularity);
    const series = new Map(buckets.map((key) => [key, { bucket: key, added: 0, completed: 0 }]));

    for (const c of addedCases) {
      const key = bucketKey(new Date(c.createdAt), granularity);
      if (series.has(key)) series.get(key).added += 1;
    }
    for (const c of completedCases) {
      const key = bucketKey(new Date(c.deliveredAt), granularity);
      if (series.has(key)) series.get(key).completed += 1;
    }

    const totals = { pending: 0, 'in-progress': 0, delivered: 0, completed: 0 };
    for (const t of statusTotals) {
      if (t.status in totals) totals[t.status] = t._count._all;
    }
    const total = totals.pending + totals['in-progress'] + totals.delivered + totals.completed;

    return NextResponse.json({
      range: { from: from.toISOString(), to: to.toISOString(), granularity },
      totals: { ...totals, total },
      series: Array.from(series.values()),
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    return NextResponse.json({ message: 'Failed to compute analytics.' }, { status: 500 });
  }
}
