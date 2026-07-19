'use client';

import { useEffect, useRef, useState } from 'react';
import { BsChatDots, BsEye, BsSend, BsPaperclip, BsXLg } from 'react-icons/bs';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/_components/ui/card';
import { Input } from '@/app/_components/ui/input';
import { Button } from '@/app/_components/ui/button';
import { Alert, AlertDescription } from '@/app/_components/ui/alert';
import Spinner from '@/app/_components/shared/Spinner';
import { cn } from '@/app/lib/utils';
import FileGrid from '@/app/_components/FileGrid';

const ROLE_LABELS = { doctor: 'Doctor', designer: 'Designer', admin: 'Admin' };

// Doctor / designer / admin can all attach these when communicating.
const ACCEPT = '.webp,.png,.jpg,.jpeg,.mp3,.doc,.docx,image/*,audio/*';

/**
 * Per-case chat thread. Messages are fetched/posted against
 * /api/cases/[id]/messages, which scopes everything to this one case's
 * doctorId/pickedBy — so this thread never mixes in messages from any
 * other case.
 *
 * All three roles can attach files (images / audio / docs) via the paperclip
 * button; attachments are uploaded to the case's "chat" Drive subfolder by
 * the API and rendered inline below each message.
 */
export default function CaseChat({ caseId, canSend = false, emptyHint = '' }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]); // { file }
  const [currentUserId, setCurrentUserId] = useState(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      setCurrentUserId(storedUser.id || null);
    } catch {
      setCurrentUserId(null);
    }
  }, []);

  useEffect(() => {
    if (!caseId) return;

    let cancelled = false;

    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/cases/${caseId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load chat');
        if (!cancelled) {
          setMessages(data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [caseId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const onPickFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length) setAttachments((prev) => [...prev, ...picked.map((file) => ({ file }))]);
    // Reset so picking the same file again re-triggers onChange.
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body && attachments.length === 0) return;

    setSending(true);
    try {
      const token = localStorage.getItem('token');

      let res;
      if (attachments.length > 0) {
        const fd = new FormData();
        if (body) fd.append('body', body);
        attachments.forEach(({ file }) => fd.append('attachments', file));
        res = await fetch(`/api/cases/${caseId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
      } else {
        res = await fetch(`/api/cases/${caseId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ body }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send message');
      setMessages((prev) => [...prev, data]);
      setText('');
      setAttachments([]);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const canSubmit = text.trim() || attachments.length > 0;

  return (
    <Card className="mb-4 border-0 shadow-sm">
      <CardHeader className="border-b py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BsChatDots className="text-primary" />
          Case Chat
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-3 py-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div ref={scrollRef} className="mb-3 h-80 overflow-y-auto rounded-md border bg-muted/40 p-3">
          {loading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">Loading chat...</div>
          ) : messages.length === 0 ? (
            <div className="py-4 text-center text-sm italic text-muted-foreground">
              No messages yet.{emptyHint ? ` ${emptyHint}` : ''}
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.senderId?._id === currentUserId;
              const name = m.senderId
                ? `${m.senderId.firstName || ''} ${m.senderId.lastName || ''}`.trim() || m.senderId.email
                : 'Unknown';
              const hasAttachments = Array.isArray(m.attachments) && m.attachments.length > 0;
              return (
                <div key={m._id} className={cn('mb-3 flex', isMine ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[75%] rounded-2xl px-3 py-2',
                      isMine ? 'bg-primary text-primary-foreground' : 'border bg-white'
                    )}
                  >
                    <div className={cn('mb-1 text-xs font-semibold', isMine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                      {name} · {ROLE_LABELS[m.senderRole] || m.senderRole}
                    </div>
                    {m.body && <div className="whitespace-pre-wrap text-sm">{m.body}</div>}
                    {hasAttachments && (
                      <div className={m.body ? 'mt-2' : ''}>
                        <FileGrid files={m.attachments} emptyLabel="" />
                      </div>
                    )}
                    <div className={cn('mt-1 text-xs', isMine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                      {new Date(m.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {canSend ? (
          <form onSubmit={handleSend}>
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map(({ file }, idx) => (
                  <span
                    key={`${file.name}-${idx}`}
                    className="inline-flex max-w-[180px] items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs"
                    title={file.name}
                  >
                    <BsPaperclip className="shrink-0 text-muted-foreground" />
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${file.name}`}
                    >
                      <BsXLg />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={onPickFiles}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                aria-label="Attach files"
                title="Attach image, audio or document"
              >
                <BsPaperclip />
              </Button>
              <Input
                type="text"
                placeholder="Type a message..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={sending}
                maxLength={2000}
              />
              <Button type="submit" disabled={sending || !canSubmit} className="shrink-0 gap-2">
                {sending ? (
                  <Spinner className="border-white border-t-transparent" />
                ) : (
                  <>
                    <BsSend /> Send
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <p className="mb-0 text-sm italic text-muted-foreground">
            <BsEye className="mr-1 inline" />Read-only view — admin tracking only.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
