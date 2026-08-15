'use client';

import { useEffect, useState } from 'react';

import { usePathname } from '@/i18n/navigation';

/**
 * Thin top progress bar that fires on client navigations. Complements
 * route-level `loading.tsx` skeletons so the user gets immediate feedback.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    setVisible(true);
    setWidth(12);
    const ramp = window.setTimeout(() => setWidth(70), 40);
    const done = window.setTimeout(() => {
      setWidth(100);
      window.setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 220);
    }, 280);

    return () => {
      window.clearTimeout(ramp);
      window.clearTimeout(done);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
      role="progressbar"
      aria-hidden
    >
      <div
        className="h-full bg-brand transition-[width] duration-300 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
