import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken, requireUser } from '@/app/lib/auth';
import { serializeMessage } from '@/app/lib/serialize';

const SENDER_SELECT = { id: true, firstName: true, lastName: true, email: true, role: true };

/**
 * Resolves who is allowed to see/post in a case's chat.
 * - doctor: only the doctor who owns the case.
 * - designer: only the designer who has picked the case (a chat partner
 *   doesn't exist until someone has picked it up).
 * - admin: read-only access to any case's chat, for tracking purposes.
 * Returns { decoded, caseDoc, canPost } or { error: NextResponse }.
 */
async function authorizeCaseChat(req, id) {
  const decoded = verifyToken(req);
  if (!decoded) {
    return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  }

  const caseId = Number(id);

  if (decoded.role === 'admin') {
    const caseDoc = await prisma.case.findUnique({
      where: { id: caseId },
      select: { doctorId: true, pickedById: true },
    });
    if (!caseDoc) {
      return { error: NextResponse.json({ message: 'Case not found' }, { status: 404 }) };
    }
    return { decoded, caseDoc, canPost: false };
  }

  const { error } = await requireUser(req, ['doctor', 'designer']);
  if (error) return { error };

  const caseDoc = await prisma.case.findUnique({
    where: { id: caseId },
    select: { doctorId: true, pickedById: true },
  });
  if (!caseDoc) {
    return { error: NextResponse.json({ message: 'Case not found' }, { status: 404 }) };
  }

  if (decoded.role === 'doctor') {
    if (String(caseDoc.doctorId) !== decoded.userId) {
      return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) };
    }
  } else {
    // designer
    if (caseDoc.pickedById == null || String(caseDoc.pickedById) !== decoded.userId) {
      return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) };
    }
  }

  return { decoded, caseDoc, canPost: true };
}

/**
 * GET /api/cases/[id]/messages
 * Returns the chat thread for a single case, scoped strictly to that
 * case's own messages (never merged with other cases' conversations).
 */
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const auth = await authorizeCaseChat(req, id);
    if (auth.error) return auth.error;

    const messages = await prisma.message.findMany({
      where: { caseId: Number(id) },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: SENDER_SELECT } },
    });

    return NextResponse.json(messages.map(serializeMessage));
  } catch (error) {
    console.error('GET messages error:', error);
    return NextResponse.json({ message: 'Failed to fetch messages.' }, { status: 500 });
  }
}

/**
 * POST /api/cases/[id]/messages
 * Doctor/designer only (admin has read-only tracking access).
 * Body: { body: string }
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const auth = await authorizeCaseChat(req, id);
    if (auth.error) return auth.error;

    if (!auth.canPost) {
      return NextResponse.json({ message: 'Admins cannot send messages in this chat.' }, { status: 403 });
    }

    const body = await req.json();
    const text = (body.body || '').trim();
    if (!text) {
      return NextResponse.json({ message: 'Message cannot be empty.' }, { status: 400 });
    }
    if (text.length > 2000) {
      return NextResponse.json({ message: 'Message is too long.' }, { status: 400 });
    }

    const message = await prisma.message.create({
      data: {
        caseId: Number(id),
        senderId: Number(auth.decoded.userId),
        senderRole: auth.decoded.role,
        body: text,
      },
      include: { sender: { select: SENDER_SELECT } },
    });

    return NextResponse.json(serializeMessage(message), { status: 201 });
  } catch (error) {
    console.error('POST message error:', error);
    return NextResponse.json({ message: 'Failed to send message.' }, { status: 500 });
  }
}
