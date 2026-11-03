import { AppHeader } from "@/components/AppHeader";

function SkelLine({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[var(--border)]/70 ${className}`} />
  );
}

function SkelCard() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="h-32 bg-[var(--border)]/40 animate-pulse" />
      <div className="p-4 space-y-2">
        <SkelLine className="h-7 w-3/4" />
        <div className="flex items-center gap-4">
          <SkelLine className="h-3.5 w-10" />
          <SkelLine className="h-3.5 w-16" />
          <SkelLine className="h-3.5 w-24" />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <AppHeader current="/recipes" />
      <div className="space-y-2">
        <SkelLine className="h-9 w-32" />
        <SkelLine className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkelCard key={i} />
        ))}
        <div className="rounded-2xl border-2 border-dashed border-[var(--border)] flex items-center justify-center min-h-[14rem]">
          <div className="h-8 w-8 rounded-full bg-[var(--border)]/60 animate-pulse" />
        </div>
      </div>
    </main>
  );
}
