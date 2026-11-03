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
        <SkelLine className="h-5 w-3/4" />
        <SkelLine className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <AppHeader current="/recipes" />
      <div>
        <h1 className="font-serif text-3xl text-[var(--foreground)]">Recipes</h1>
        <SkelLine className="h-4 w-72 mt-2" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkelCard key={i} />
        ))}
      </div>
    </main>
  );
}
