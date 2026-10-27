'use client';

import { useEffect, useRef } from 'react';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise = null;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Could not load Google sign-in'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

// Reads name/email out of the Google ID token for display only.
// The server verifies the token itself — nothing here is trusted.
export function readGoogleProfile(credential) {
  try {
    const part = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(part), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return { email: payload.email || '', name: payload.name || '' };
  } catch {
    return { email: '', name: '' };
  }
}

/**
 * Official "Sign in with Google" button (Google Identity Services).
 * Calls onCredential(idToken) when the user picks a Google account; the
 * server verifies that token — never trust anything decoded on the client.
 *
 * text: 'signup_with' | 'signin_with' | 'continue_with'
 */
export default function GoogleSignInButton({ onCredential, onError, text = 'continue_with', disabled = false }) {
  const containerRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCredentialRef.current = onCredential;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => onCredentialRef.current?.(response.credential),
          ux_mode: 'popup',
        });
        containerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text,
          logo_alignment: 'center',
          width: Math.max(200, Math.min(400, containerRef.current.offsetWidth || 400)),
        });
      })
      .catch((err) => onErrorRef.current?.(err.message));

    return () => {
      cancelled = true;
    };
  }, [text]);

  if (!CLIENT_ID) return null;

  return (
    <div
      className={disabled ? 'pointer-events-none opacity-50' : undefined}
      aria-disabled={disabled}
    >
      <div ref={containerRef} className="flex min-h-[44px] w-full justify-center" />
    </div>
  );
}
