'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BsPalette, BsExclamationTriangleFill, BsCheckCircleFill } from 'react-icons/bs';
import { Card } from '@/app/_components/ui/card';
import { Input } from '@/app/_components/ui/input';
import { Label } from '@/app/_components/ui/label';
import { Button } from '@/app/_components/ui/button';
import { Alert, AlertDescription } from '@/app/_components/ui/alert';
import Spinner from '@/app/_components/shared/Spinner';

export default function DesignerForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleChange = (e) => {
    setEmail(e.target.value);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Request failed');
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f8f9ff_0%,#e8ecff_100%)]">
      <div className="w-full max-w-[420px] px-4">
        <Card className="rounded-2xl p-4 shadow-lg md:p-6">
          <div className="mb-4 text-center">
            <div className="mb-3 inline-flex size-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-brand-start),var(--color-brand-end))]">
              <BsPalette className="text-2xl text-white" />
            </div>
            <h3 className="font-bold text-foreground">Forgot Password</h3>
            <p className="text-sm text-muted-foreground">ClearTrackings Designer Portal</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-3">
              <BsExclamationTriangleFill />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {done ? (
            <>
              <Alert className="mb-3 border-0 bg-success/15">
                <BsCheckCircleFill className="text-success" />
                <AlertDescription>
                  Your request has been sent to the admin. They will generate a new password for you —
                  please check with them to receive it.
                </AlertDescription>
              </Alert>
              <Button asChild className="w-full bg-[linear-gradient(to_right,var(--color-brand-start),var(--color-brand-end))] py-2 text-white hover:opacity-90">
                <Link href="/designer/login">Back to login</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Enter the email on your account. The admin will be notified and create a new
                password for you.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    type="email"
                    name="email"
                    id="email"
                    required
                    autoFocus
                    value={email}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[linear-gradient(to_right,var(--color-brand-start),var(--color-brand-end))] py-2 text-white hover:opacity-90"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner className="mr-2 border-white" />
                      Sending request...
                    </>
                  ) : (
                    'Request password reset'
                  )}
                </Button>
              </form>
            </>
          )}

          <div className="mt-3 text-center">
            <small className="text-muted-foreground">
              Remembered it?{' '}
              <Link href="/designer/login" className="font-semibold text-foreground no-underline">
                Back to login
              </Link>
            </small>
          </div>
        </Card>
      </div>
    </div>
  );
}
