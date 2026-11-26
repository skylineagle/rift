import Link from 'next/link';
import { basePath } from '@/lib/shared';

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center text-center flex-1 gap-6 px-4">
      <img src={`${basePath}/icon.svg`} alt="" width={96} height={96} />
      <h1 className="text-4xl font-bold">Rift</h1>
      <p className="max-w-xl text-fd-muted-foreground">
        Bridge TCP, UDP and serial (UART) endpoints. Pipe bytes between any two sides, inspect traffic, inject data
        live.
      </p>
      <div className="flex gap-3">
        <Link href="/docs/user" className="rounded-lg bg-fd-primary px-4 py-2 font-medium text-fd-primary-foreground">
          User manual
        </Link>
        <Link href="/docs/developer" className="rounded-lg border px-4 py-2 font-medium">
          Developer manual
        </Link>
      </div>
    </main>
  );
}
