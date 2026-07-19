import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';
import { serializeCase, computeRevisionStatus } from '@/app/lib/serialize';
import { cascadeDeleteCase } from '@/app/lib/caseDelete';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };

// Map of caseId -> the latest revision's status (used so a reopened case
// shows its revision's status instead of the parent case's "completed").
const buildRevisionStatusMap = async (caseIds) => {
  const map = new Map();
  if (caseIds.length === 0) return map;
  const revs = await prisma.revision.findMany({
    where: { caseId: { in: caseIds } },
    select: { caseId: true, status: true, createdAt: true },
  });
  const grouped = new Map();
  for (const r of revs) {
    if (!grouped.has(r.caseId)) grouped.set(r.caseId, []);
    grouped.get(r.caseId).push(r);
  }
  for (const [caseId, list] of grouped) {
    const status = computeRevisionStatus(list);
    if (status) map.set(caseId, status);
  }
  return map;
};

/**
 * GET /api/admin/cases
 * Admin: returns every case in the system, unfiltered and unredacted.
 * Optional ?status=pending|in-progress|completed and ?doctorId=<id> filters.
 */
export async function GET(req) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const doctorId = searchParams.get('doctorId');

    const where = {};
    if (doctorId) where.doctorId = Number(doctorId);

    const cases = await prisma.case.findMany({
      where,
      include: { doctor: { select: REF_SELECT }, pickedBy: { select: REF_SELECT } },
      orderBy: { createdAt: 'desc' },
    });

    const revMap = await buildRevisionStatusMap(cases.map((c) => c.id));
    let result = cases.map((c) => {
      const obj = serializeCase(c);
      if (revMap.has(c.id)) obj.revisionStatus = revMap.get(c.id);
      return obj;
    });

    // Filter by the EFFECTIVE status (latest revision status when reopened).
    if (status && status !== 'all') {
      result = result.filter((c) => (c.revisionStatus ?? c.status) === status);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Admin GET cases error:', error);
    return NextResponse.json({ message: 'Failed to fetch cases.' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/cases
 * Admin only. Bulk delete. Body: { ids: string[] }.
 * Each case is removed with the same cascade as a single delete
 * (chat messages, Drive attachments, the case folder). Cases that no
 * longer exist are skipped; the response reports how many were actually
 * deleted. Best-effort per case — one failing case doesn't abort the rest.
 */
export async function DELETE(req) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.map((x) => Number(x)).filter((x) => Number.isInteger(x)) : [];
    if (ids.length === 0) {
      return NextResponse.json({ message: 'No case ids provided' }, { status: 400 });
    }

    const results = await Promise.all(ids.map((id) => cascadeDeleteCase(id)));
    const deleted = results.filter((r) => r.found).length;

    return NextResponse.json({ message: `Deleted ${deleted} case${deleted === 1 ? '' : 's'}`, deleted });
  } catch (error) {
    console.error('Admin bulk DELETE cases error:', error);
    return NextResponse.json({ message: 'Failed to delete cases.' }, { status: 500 });
  }
}
