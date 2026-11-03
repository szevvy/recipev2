import { AppHeader } from "@/components/AppHeader";

function SkelLine({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[var(--border)]/70 ${className}`} />
  );
}

function SkelRow() {
  return (
    <li className="flex items-center gap-2 px-2 py-1.5">
      <div className="h-7 w-7 rounded-full bg-[var(--border)]/60 animate-pulse" />
      <SkelLine className="h-4 flex-1" />
      <div className="h-7 w-12 rounded-full bg-[var(--border)]/60 animate-pulse" />
    </li>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <AppHeader current="/shopping" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-[var(--foreground)]">Shopping</h1>
          <SkelLine className="h-4 w-40 mt-2" />
        </div>
        <div className="h-9 w-32 rounded-full bg-[var(--border)]/60 animate-pulse" />
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-4">
        <SkelLine className="h-4 w-24" />
        <ul className="divide-y divide-[var(--border)]/60 bg-[var(--surface-muted)]/60 rounded-xl p-1">
          <SkelRow />
          <SkelRow />
          <SkelRow />
          <SkelRow />
          <SkelRow />
        </ul>
        <SkelLine className="h-4 w-20 mt-4" />
        <ul className="divide-y divide-[var(--border)]/60 bg-[var(--surface-muted)]/60 rounded-xl p-1">
          <SkelRow />
          <SkelRow />
          <SkelRow />
        </ul>
      </section>
    </main>
  );
}
