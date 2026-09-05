'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

const Recaptcha = forwardRef(function Recaptcha({ onVerify, onExpire }, ref) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(widgetIdRef.current);
      }
    },
  }));

  useEffect(() => {
    if (!SITE_KEY) return;

    const render = () => {
      if (!window.grecaptcha || !containerRef.current) return;
      widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token) => onVerify?.(token),
        'expired-callback': () => onExpire?.(),
      });
      setReady(true);
    };

    if (window.grecaptcha) {
      render();
      return;
    }

    window.__recaptchaOnLoad = render;
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?onload=__recaptchaOnLoad&render=explicit`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(widgetIdRef.current);
      }
    };
  }, []);

  if (!SITE_KEY) return null;

  return (
    <div className="flex justify-center">
      <div ref={containerRef} />
    </div>
  );
});

export default Recaptcha;
