import { AppHeader } from "@/components/AppHeader";

function SkelLine({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[var(--border)]/70 ${className}`} />
  );
}

function SkelRow() {
  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5">
      <div className="h-7 w-7 rounded-full bg-[var(--border)]/60 animate-pulse shrink-0" />
      <SkelLine className="h-4 flex-1 max-w-xs" />
      <div className="h-7 w-7 rounded-full bg-[var(--border)]/60 animate-pulse shrink-0" />
      <div className="h-7 w-7 rounded-full bg-[var(--border)]/60 animate-pulse shrink-0" />
    </li>
  );
}

function SkelGroup({ rowCount }: { rowCount: number }) {
  return (
    <section className="space-y-2">
      <SkelLine className="h-7 w-32 ml-1" />
      <ul className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm divide-y divide-[var(--border)]/70 p-1">
        {Array.from({ length: rowCount }).map((_, i) => (
          <SkelRow key={i} />
        ))}
      </ul>
    </section>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto space-y-6">
      <AppHeader current="/ingredients" />
      <div>
        <h1 className="font-serif text-3xl text-[var(--foreground)]">Ingredients</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          The star marks staples. Groups come from whatever you type in the Group field.
        </p>
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-4 space-y-3">
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
          Add ingredient
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1.5fr_auto_auto] gap-2 items-end">
          <div className="space-y-0.5">
            <span className="text-xs text-[var(--muted)]">Name</span>
            <div className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]" />
          </div>
          <div className="space-y-0.5">
            <span className="text-xs text-[var(--muted)]">Group</span>
            <div className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]" />
          </div>
          <div className="h-9 w-9 rounded-full bg-[var(--border)]/40 animate-pulse" />
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] text-white text-sm px-3 py-1.5 opacity-60"
          >
            Add
          </button>
        </div>
      </div>
      <div className="space-y-6">
        <SkelGroup rowCount={5} />
        <SkelGroup rowCount={3} />
        <SkelGroup rowCount={6} />
      </div>
    </main>
  );
}
