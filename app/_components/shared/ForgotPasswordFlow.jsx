'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BsExclamationTriangleFill, BsCheckCircleFill } from 'react-icons/bs';
import { Card } from '@/app/_components/ui/card';
import { Input } from '@/app/_components/ui/input';
import { Label } from '@/app/_components/ui/label';
import { Button } from '@/app/_components/ui/button';
import { Alert, AlertDescription } from '@/app/_components/ui/alert';
import Spinner from '@/app/_components/shared/Spinner';
import PasswordInput from '@/app/_components/shared/PasswordInput';

const OTP_LENGTH = 6;
const BRAND_BUTTON =
  'w-full bg-[linear-gradient(to_right,var(--color-brand-start),var(--color-brand-end))] py-2 text-white hover:opacity-90';

function formatSeconds(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

/**
 * Three-step password reset used by both the doctor and designer portals:
 *   1. email  → server emails a 6-digit OTP
 *   2. otp    → server verifies it and returns a short-lived reset token
 *   3. password → new password is saved with that token
 */
export default function ForgotPasswordFlow({
  role,
  portalName,
  icon: Icon,
  loginHref,
  titleClassName = 'text-primary',
  linkClassName = 'text-primary',
}) {
  const router = useRouter();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Tick once a second while the OTP screen is showing, for the countdowns
  useEffect(() => {
    if (step !== 'otp') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step]);

  const secondsToExpiry = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const secondsToResend = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const otpExpired = step === 'otp' && secondsToExpiry === 0;

  const requestOtp = async () => {
    const data = await postJson('/api/auth/forgot-password', { email, role });
    const t = Date.now();
    setNow(t);
    setExpiresAt(t + (data.expiresInSeconds || 600) * 1000);
    setResendAt(t + (data.resendAfterSeconds || 60) * 1000);
    setOtp('');
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      await requestOtp();
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError('');
    setInfo('');
    try {
      await requestOtp();
      setInfo('A new code has been sent. Any earlier code no longer works.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const data = await postJson('/api/auth/verify-otp', { email, role, otp });
      setResetToken(data.resetToken);
      setStep('password');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await postJson('/api/auth/reset-password', { resetToken, password });
      setResetToken('');
      setStep('done');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setStep('email');
    setOtp('');
    setPassword('');
    setConfirmPassword('');
    setResetToken('');
    setError('');
    setInfo('');
  };

  const subtitle = {
    email: 'Enter the email on your account and we will send you a 6-digit verification code.',
    otp: (
      <>
        If an account exists for <strong className="text-foreground">{email}</strong>, we have sent a{' '}
        {OTP_LENGTH}-digit code to it. Check your inbox and spam folder.
      </>
    ),
    password: 'Code verified. Choose a new password for your account.',
  }[step];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f8f9ff_0%,#e8ecff_100%)]">
      <div className="w-full max-w-[420px] px-4">
        <Card className="rounded-2xl p-4 shadow-lg md:p-6">
          <div className="mb-4 text-center">
            <div className="mb-3 inline-flex size-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-brand-start),var(--color-brand-end))]">
              <Icon className="text-2xl text-white" />
            </div>
            <h3 className={`font-bold ${titleClassName}`}>
              {step === 'otp' ? 'Enter Verification Code' : step === 'password' ? 'Set New Password' : 'Forgot Password'}
            </h3>
            <p className="text-sm text-muted-foreground">ClearTrackings {portalName} Portal</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-3">
              <BsExclamationTriangleFill />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {info && (
            <Alert className="mb-3 border-0 bg-success/15">
              <BsCheckCircleFill className="text-success" />
              <AlertDescription>{info}</AlertDescription>
            </Alert>
          )}

          {step === 'done' ? (
            <>
              <Alert className="mb-3 border-0 bg-success/15">
                <BsCheckCircleFill className="text-success" />
                <AlertDescription>
                  Your password has been reset. You can now log in with your new password.
                </AlertDescription>
              </Alert>
              <Button className={BRAND_BUTTON} onClick={() => router.push(loginHref)}>
                Go to login
              </Button>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">{subtitle}</p>

              {step === 'email' && (
                <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      type="email"
                      name="email"
                      id="email"
                      required
                      autoFocus
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                      }}
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" className={BRAND_BUTTON} disabled={loading}>
                    {loading ? (
                      <>
                        <Spinner className="mr-2 border-white" />
                        Sending code...
                      </>
                    ) : (
                      'Send verification code'
                    )}
                  </Button>
                </form>
              )}

              {step === 'otp' && (
                <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="otp">Verification code</Label>
                    <Input
                      type="text"
                      name="otp"
                      id="otp"
                      required
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern={`\\d{${OTP_LENGTH}}`}
                      maxLength={OTP_LENGTH}
                      placeholder={'•'.repeat(OTP_LENGTH)}
                      className="h-12 text-center font-mono text-2xl tracking-[0.5em] md:text-2xl"
                      value={otp}
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH));
                        setError('');
                      }}
                      disabled={loading || otpExpired}
                    />
                    <p className={`text-xs ${otpExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {otpExpired
                        ? 'This code has expired. Please request a new one.'
                        : `Code expires in ${formatSeconds(secondsToExpiry)}`}
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className={BRAND_BUTTON}
                    disabled={loading || otpExpired || otp.length !== OTP_LENGTH}
                  >
                    {loading ? (
                      <>
                        <Spinner className="mr-2 border-white" />
                        Verifying...
                      </>
                    ) : (
                      'Verify code'
                    )}
                  </Button>
                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={startOver}
                      className="text-muted-foreground hover:underline"
                      disabled={loading}
                    >
                      Change email
                    </button>
                    {secondsToResend > 0 ? (
                      <span className="text-muted-foreground">Resend in {formatSeconds(secondsToResend)}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        className={`font-semibold hover:underline ${linkClassName}`}
                        disabled={loading}
                      >
                        Resend code
                      </button>
                    )}
                  </div>
                </form>
              )}

              {step === 'password' && (
                <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="password">New password</Label>
                    <PasswordInput
                      name="password"
                      id="password"
                      required
                      autoFocus
                      minLength={6}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      disabled={loading}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="confirmPassword">Confirm new password</Label>
                    <PasswordInput
                      name="confirmPassword"
                      id="confirmPassword"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setError('');
                      }}
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" className={BRAND_BUTTON} disabled={loading}>
                    {loading ? (
                      <>
                        <Spinner className="mr-2 border-white" />
                        Saving...
                      </>
                    ) : (
                      'Reset password'
                    )}
                  </Button>
                  {error && error.includes('expired') && (
                    <button
                      type="button"
                      onClick={startOver}
                      className={`text-sm font-semibold hover:underline ${linkClassName}`}
                    >
                      Start again
                    </button>
                  )}
                </form>
              )}
            </>
          )}

          {step !== 'done' && (
            <div className="mt-3 text-center">
              <small className="text-muted-foreground">
                Remembered it?{' '}
                <Link href={loginHref} className={`font-semibold no-underline ${linkClassName}`}>
                  Back to login
                </Link>
              </small>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
