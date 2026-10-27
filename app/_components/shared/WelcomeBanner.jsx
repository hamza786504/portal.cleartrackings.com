'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BsX,
  BsStars,
  BsPlusCircle,
  BsSearch,
  BsCheck2Circle,
  BsArrowRepeat,
  BsPalette,
  BsSend,
} from 'react-icons/bs';
import { Button } from '@/app/_components/ui/button';

const CONTENT = {
  doctor: {
    greeting: (u) => (u.firstName ? `Welcome to ClearTrackings, Dr. ${u.firstName}!` : 'Welcome to ClearTrackings!'),
    intro: 'Your account is approved and ready. Here is how ClearTrackings works for you:',
    steps: [
      { icon: BsPlusCircle, title: 'Submit a case', text: 'Upload scans, photos and your treatment goals.' },
      { icon: BsSearch, title: 'Track progress', text: 'Follow every case from pending to delivered.' },
      { icon: BsCheck2Circle, title: 'Review & approve', text: 'Check the delivered design and approve it.' },
      { icon: BsArrowRepeat, title: 'Request revisions', text: 'Need changes? Open a revision on any completed case.' },
    ],
    cta: { href: '/doctor/cases/add', label: 'Submit a case' },
  },
  designer: {
    greeting: (u) => (u.firstName ? `Welcome to ClearTrackings, ${u.firstName}!` : 'Welcome to ClearTrackings!'),
    intro: 'Your account is approved and ready. Here is how ClearTrackings works for you:',
    steps: [
      { icon: BsSearch, title: 'Find cases', text: 'Browse cases from the doctors you are assigned to.' },
      { icon: BsPalette, title: 'Pick & design', text: 'Pick a case to claim it, then work on the design.' },
      { icon: BsSend, title: 'Deliver', text: 'Submit your design link for the doctor to review.' },
      { icon: BsArrowRepeat, title: 'Handle revisions', text: 'Pick up revision requests when doctors need changes.' },
    ],
    cta: { href: '/designer/cases', label: 'Browse cases' },
  },
};

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

/**
 * One-time welcome jumbotron for doctors and designers. The login response
 * sets user.showWelcome only on the account's very first login; closing the
 * banner clears it, so it never comes back for that user.
 */
export default function WelcomeBanner({ role }) {
  const [user, setUser] = useState(() =>
    typeof window === 'undefined' ? null : readStoredUser()
  );

  const content = CONTENT[role];
  if (!content || !user?.showWelcome || user.role !== role) return null;

  const dismiss = () => {
    const updated = { ...user, showWelcome: false };
    try {
      localStorage.setItem('user', JSON.stringify(updated));
    } catch {
      // Storage unavailable — it still won't show on the next login
    }
    setUser(updated);
  };

  return (
    <section
      aria-label="Welcome"
      className="relative mb-4 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--color-brand-start),var(--color-brand-end))] p-5 text-white shadow-md md:p-7"
    >
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 size-48 rounded-full bg-white/5" />

      <button
        type="button"
        onClick={dismiss}
        aria-label="Close welcome message"
        className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
      >
        <BsX className="size-6" />
      </button>

      <div className="relative">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
          <BsStars /> Getting started
        </div>
        <h2 className="mb-1 pr-8 text-2xl font-bold md:text-3xl">{content.greeting(user)}</h2>
        <p className="mb-5 max-w-2xl text-sm text-white/85 md:text-base">{content.intro}</p>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {content.steps.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="rounded-xl bg-white/10 p-3 backdrop-blur-[2px]">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-white/20">
                  <Icon className="size-4" />
                </span>
                <span className="text-xs font-semibold text-white/70">Step {i + 1}</span>
              </div>
              <div className="font-semibold">{title}</div>
              <div className="text-sm text-white/80">{text}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild className="bg-white font-semibold text-[var(--color-brand-start)] hover:bg-white/90">
            <Link href={content.cta.href} onClick={dismiss}>
              {content.cta.label}
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-white hover:bg-white/15 hover:text-white"
            onClick={dismiss}
          >
            Got it
          </Button>
        </div>
      </div>
    </section>
  );
}
