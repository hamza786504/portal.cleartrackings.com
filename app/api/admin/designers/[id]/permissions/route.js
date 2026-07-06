import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';
import { serializeDesigner } from '@/app/lib/serialize';

const REF_SELECT = { id: true, firstName: true, lastName: true, email: true };

/**
 * PUT /api/admin/designers/[id]/permissions
 * Admin: set the full list of doctors a designer is allowed to browse/pick
 * cases from. Body: { doctorIds: string[] }
 */
export async function PUT(req, { params }) {
  try {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { doctorIds } = await req.json();

    if (!Array.isArray(doctorIds)) {
      return NextResponse.json({ message: 'doctorIds must be an array' }, { status: 400 });
    }

    const designerId = Number(id);
    const designer = await prisma.user.findUnique({ where: { id: designerId } });
    if (!designer) {
      return NextResponse.json({ message: 'Designer not found' }, { status: 404 });
    }
    if (designer.role !== 'designer') {
      return NextResponse.json({ message: 'User is not a designer' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.designerPermission.deleteMany({ where: { designerId } });
      if (doctorIds.length > 0) {
        await tx.designerPermission.createMany({
          data: doctorIds.map((docId) => ({ designerId, doctorId: Number(docId) })),
          skipDuplicates: true,
        });
      }
    });

    const updated = await prisma.user.findUnique({
      where: { id: designerId },
      include: { permissionsAsDesigner: { include: { doctor: { select: REF_SELECT } } } },
    });

    return NextResponse.json(serializeDesigner(updated));
  } catch (error) {
    console.error('Set designer permissions error:', error);
    return NextResponse.json({ message: 'Failed to update permissions.' }, { status: 500 });
  }
}
