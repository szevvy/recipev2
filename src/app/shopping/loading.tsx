import { AppHeader } from "@/components/AppHeader";

function SkelLine({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[var(--border)]/70 ${className}`} />
  );
}

function SkelRow() {
  return (
    <li className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
      <div className="h-7 w-7 rounded-full border border-[var(--border)] shrink-0" />
      <SkelLine className="h-4 flex-1 max-w-[18rem]" />
      <div className="h-7 w-16 rounded-full bg-[var(--border)]/60 animate-pulse shrink-0" />
    </li>
  );
}

function SkelGroup({ rowCount }: { rowCount: number }) {
  return (
    <section className="space-y-1">
      <SkelLine className="h-6 w-28" />
      <ul className="divide-y divide-[var(--border)]/60 bg-[var(--surface-muted)]/60 rounded-xl p-1">
        {Array.from({ length: rowCount }).map((_, i) => (
          <SkelRow key={i} />
        ))}
      </ul>
    </section>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <AppHeader current="/shopping" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-[var(--foreground)]">Shopping</h1>
          <SkelLine className="h-4 w-56 mt-2" />
        </div>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sage)] text-white text-sm px-4 py-2 opacity-60"
        >
          Finish shopping
        </button>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-5">
        <SkelGroup rowCount={5} />
        <SkelGroup rowCount={3} />
        <SkelGroup rowCount={4} />
      </section>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-4 h-[3.75rem] animate-pulse" />

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-3">
        <div>
          <h2 className="font-serif text-xl text-[var(--foreground)]">Add something</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Pick an ingredient to merge quantities, or type anything else (a light
            bulb, batteries) to add as a one-off.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] gap-2 items-end">
          <div className="space-y-0.5">
            <span className="text-xs text-[var(--muted)]">Item</span>
            <div className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]" />
          </div>
          <div className="space-y-0.5">
            <span className="text-xs text-[var(--muted)]">Quantity</span>
            <div className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]" />
          </div>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] text-white text-sm px-3 py-1.5 opacity-60"
          >
            Add
          </button>
        </div>
      </section>
    </main>
  );
}
