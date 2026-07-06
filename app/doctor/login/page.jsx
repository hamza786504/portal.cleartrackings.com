'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BsPersonBadge, BsSlashCircleFill, BsExclamationTriangleFill } from 'react-icons/bs';
import { Card } from '@/app/_components/ui/card';
import { Input } from '@/app/_components/ui/input';
import { Label } from '@/app/_components/ui/label';
import { Button } from '@/app/_components/ui/button';
import { Alert, AlertDescription } from '@/app/_components/ui/alert';
import Spinner from '@/app/_components/shared/Spinner';
import PasswordInput from '@/app/_components/shared/PasswordInput';

export default function DoctorLogin() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suspendedNotice, setSuspendedNotice] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('suspended') === '1') {
      setSuspendedNotice(true);
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      router.push('/doctor/dashboard');
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
              <BsPersonBadge className="text-2xl text-white" />
            </div>
            <h3 className="font-bold text-primary">Doctor Login</h3>
            <p className="text-sm text-muted-foreground">ClearTrackings Doctor Portal</p>
          </div>

          {suspendedNotice && !error && (
            <Alert className="mb-3 border-0 bg-warning/15">
              <BsSlashCircleFill />
              <AlertDescription>Your account has been suspended by the admin. Contact them for access.</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-3">
              <BsExclamationTriangleFill />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                type="email"
                name="email"
                id="email"
                required
                autoFocus
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                name="password"
                id="password"
                required
                value={formData.password}
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
                  Logging in...
                </>
              ) : (
                'Login as Doctor'
              )}
            </Button>
          </form>

          <div className="mt-3 flex flex-col items-center gap-1 text-center">
            <small className="text-muted-foreground">
              New doctor?{' '}
              <Link href="/doctor/signup" className="font-semibold text-primary no-underline">
                Request an account
              </Link>
            </small>
            <small className="text-muted-foreground">
              Are you a designer?{' '}
              <Link href="/designer/login" className="font-semibold text-primary no-underline">
                Login here
              </Link>
            </small>
          </div>
        </Card>
      </div>
    </div>
  );
}
