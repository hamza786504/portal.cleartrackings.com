'use client';

import { useState } from 'react';
import { BsEye, BsEyeSlash } from 'react-icons/bs';
import { Input } from '@/app/_components/ui/input';
import { cn } from '@/app/lib/utils';

/**
 * Password <Input> with a show/hide toggle. Drop-in replacement for
 * <Input type="password" ...> — all other props pass straight through.
 */
export default function PasswordInput({ className, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
      >
        {visible ? <BsEye /> : <BsEyeSlash />}
      </button>
    </div>
  );
}
