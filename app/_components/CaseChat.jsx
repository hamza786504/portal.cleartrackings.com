'use client';

import { useEffect, useRef, useState } from 'react';
import { BsChatDots, BsEye, BsSend } from 'react-icons/bs';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/_components/ui/card';
import { Input } from '@/app/_components/ui/input';
import { Button } from '@/app/_components/ui/button';
import { Alert, AlertDescription } from '@/app/_components/ui/alert';
import Spinner from '@/app/_components/shared/Spinner';
import { cn } from '@/app/lib/utils';

const ROLE_LABELS = { doctor: 'Doctor', designer: 'Designer', admin: 'Admin' };

/**
 * Per-case chat thread. Messages are fetched/posted against
 * /api/cases/[id]/messages, which scopes everything to this one case's
 * doctorId/pickedBy — so this thread never mixes in messages from any
 * other case.
 */
export default function CaseChat({ caseId, canSend = false, emptyHint = '' }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const scrollRef = useRef(null);

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

  const handleSend = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/cases/${caseId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send message');
      setMessages((prev) => [...prev, data]);
      setText('');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

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
                    <div className="whitespace-pre-wrap text-sm">{m.body}</div>
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
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              type="text"
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={sending}
              maxLength={2000}
            />
            <Button type="submit" disabled={sending || !text.trim()} className="gap-2">
              {sending ? (
                <Spinner className="border-white border-t-transparent" />
              ) : (
                <>
                  <BsSend /> Send
                </>
              )}
            </Button>
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
