'use client';

import { useState } from 'react';

/**
 * Drives the auth background's focus zoom/blur. Spread `formFocusProps` on the
 * auth <form>, and apply `auth--focused` to the page's <main> when `focused`.
 * Blur only clears when focus leaves the form entirely (not when moving between
 * fields within it).
 */
export function useAuthFocus() {
  const [focused, setFocused] = useState(false);
  const formFocusProps = {
    onFocusCapture: () => setFocused(true),
    onBlurCapture: (e: React.FocusEvent<HTMLFormElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
    },
  };
  return { focused, formFocusProps };
}
