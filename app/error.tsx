'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error]', error);
  }, [error]);

  return (
    <main className="grid min-h-screen-safe place-items-center bg-[#ead8bd] p-8">
      <button
        type="button"
        onClick={reset}
        aria-label="다시 시도"
        className="grid h-24 w-24 place-items-center border-4 border-[#4a2e1c] bg-[#e7c894] text-[#6f4424]"
      >
        <span className="relative grid h-14 w-14 place-items-center">
          <TriangleAlert aria-hidden="true" className="h-14 w-14" strokeWidth={2.6} />
          <RotateCcw aria-hidden="true" className="absolute h-6 w-6 translate-y-1" strokeWidth={2.6} />
        </span>
      </button>
    </main>
  );
}
