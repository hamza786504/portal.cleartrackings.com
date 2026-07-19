import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { verifyToken, requireUser } from '@/app/lib/auth';
import { serializeMessage } from '@/app/lib/serialize';
import driveService from '@/app/lib/googleDrive';

const SENDER_SELECT = { id: true, firstName: true, lastName: true, email: true, role: true };

/**
 * Resolves who is allowed to see/post in a case's chat.
 * - doctor: only the doctor who owns the case.
 * - designer: only the designer who has picked the case (a chat partner
 *   doesn't exist until someone has picked it up).
 * - admin: full access to any case's chat (used for tracking AND for
 *   sharing files/instructions with the doctor & designer).
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
    // Admins can post too — they use the chat to share files/instructions
    // with the doctor & designer for communication.
    return { decoded, caseDoc, canPost: true };
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
    const pickedThisCase = caseDoc.pickedById != null && String(caseDoc.pickedById) === decoded.userId;
    if (!pickedThisCase) {
      // A designer who picked a REVISION of this case may also chat in the
      // shared case thread (revisions reuse the parent case's chat).
      const pickedRevision = await prisma.revision.findFirst({
        where: { caseId: Number(id), pickedById: Number(decoded.userId) },
        select: { id: true },
      });
      if (!pickedRevision) {
        return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) };
      }
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
 * Convert a Web API File into the buffer object the Drive uploader expects.
 */
async function toBufferObj(file) {
  const arrayBuffer = await file.arrayBuffer();
  return {
    originalname: file.name,
    mimetype: file.type || 'application/octet-stream',
    buffer: Buffer.from(arrayBuffer),
  };
}

/**
 * Resolve the case's "chat" Drive subfolder, creating the folder structure
 * lazily if this is an older case that predates per-case folders. Returns the
 * chat subfolder id (or null if Drive setup failed).
 */
async function resolveChatFolderId(caseId) {
  try {
    const caseDoc = await prisma.case.findUnique({
      where: { id: Number(caseId) },
      select: { chatFolderId: true, googleDriveFolderId: true, caseFolderName: true, patientName: true },
    });
    if (!caseDoc) return null;

    if (caseDoc.chatFolderId) return caseDoc.chatFolderId;

    const parent = caseDoc.googleDriveFolderId || null;
    let chatFolderId = null;
    let folderInfo = null;

    if (parent) {
      chatFolderId = await driveService.ensureChatSubfolder(parent);
    } else {
      // No folder yet (pre-feature case): build the whole layout now.
      const start = new Date();
      const ymd = start.toISOString().slice(0, 10);
      const folderName = `${ymd} - ${caseDoc.patientName?.trim() || 'Unnamed Patient'}`;
      folderInfo = await driveService.ensureCaseFolders(folderName);
      chatFolderId = folderInfo.chatFolderId;
    }

    const update = { chatFolderId };
    if (folderInfo) {
      update.googleDriveFolderId = folderInfo.caseFolderId;
      update.caseFolderName = folderInfo.caseFolderName;
    }
    await prisma.case.update({ where: { id: Number(caseId) }, data: update });
    return chatFolderId;
  } catch (err) {
    console.error('resolveChatFolderId failed:', err);
    return null;
  }
}

/**
 * POST /api/cases/[id]/messages
 * Doctor/designer/admin — all three can post text and attach files for
 * communication. Accepts either JSON { body } or multipart/form-data with
 * `body` + `attachments` (one or more files). Attached files are uploaded to
 * the case's "chat" Drive subfolder. A message needs at least a body or one
 * attachment.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const auth = await authorizeCaseChat(req, id);
    if (auth.error) return auth.error;

    if (!auth.canPost) {
      return NextResponse.json({ message: 'You cannot send messages in this chat.' }, { status: 403 });
    }

    const contentType = req.headers.get('content-type') || '';
    let text = '';
    let attachmentFiles = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      text = (formData.get('body') || '').toString();
      for (const [key, value] of formData.entries()) {
        if (key === 'attachments' && value instanceof File) attachmentFiles.push(value);
      }
    } else {
      const json = await req.json().catch(() => ({}));
      text = json.body || '';
    }

    text = text.trim();

    if (!text && attachmentFiles.length === 0) {
      return NextResponse.json({ message: 'Message cannot be empty.' }, { status: 400 });
    }
    if (text.length > 2000) {
      return NextResponse.json({ message: 'Message is too long.' }, { status: 400 });
    }
    // Keep attachments reasonable — cap count to avoid abuse.
    if (attachmentFiles.length > 10) {
      return NextResponse.json({ message: 'You can attach at most 10 files per message.' }, { status: 400 });
    }

    let attachments = [];
    if (attachmentFiles.length > 0) {
      const chatFolderId = await resolveChatFolderId(id);
      const buffers = await Promise.all(attachmentFiles.map(toBufferObj));
      attachments = await driveService.uploadMultipleFiles(buffers, chatFolderId);
    }

    const message = await prisma.message.create({
      data: {
        caseId: Number(id),
        senderId: Number(auth.decoded.userId),
        senderRole: auth.decoded.role,
        body: text,
        attachments,
      },
      include: { sender: { select: SENDER_SELECT } },
    });

    return NextResponse.json(serializeMessage(message), { status: 201 });
  } catch (error) {
    console.error('POST message error:', error);
    return NextResponse.json({ message: 'Failed to send message.' }, { status: 500 });
  }
}
