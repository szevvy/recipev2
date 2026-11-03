import { AppHeader } from "@/components/AppHeader";

function SkelLine({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[var(--border)]/70 ${className}`} />
  );
}

function SkelDay() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2 min-h-[8rem]">
      <div className="flex items-baseline justify-between">
        <div className="flex-1 space-y-1.5">
          <SkelLine className="h-6 w-24" />
          <SkelLine className="h-3.5 w-20" />
        </div>
      </div>
      <div className="flex-1 min-h-[7rem] rounded-xl bg-[var(--border)]/40 animate-pulse -mx-2 -mb-2" />
    </div>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto space-y-6">
      <AppHeader current="/plan" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <SkelLine className="h-9 w-40" />
          <SkelLine className="h-4 w-52" />
        </div>
        <div className="h-9 w-64 rounded-full bg-[var(--border)]/60 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkelDay key={i} />
        ))}
      </div>
    </main>
  );
}
