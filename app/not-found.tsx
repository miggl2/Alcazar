import { Home } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-screen-safe place-items-center bg-[#ead8bd] p-8">
      <Link
        href="/"
        aria-label="홈"
        className="grid h-24 w-24 place-items-center border-4 border-[#4a2e1c] bg-[#e7c894] text-[#6f4424]"
      >
        <Home aria-hidden="true" className="h-14 w-14" strokeWidth={2.6} />
      </Link>
    </main>
  );
}
