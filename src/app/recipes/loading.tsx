import { Plus } from "lucide-react";
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
      <div>
        <h1 className="font-serif text-3xl text-[var(--foreground)]">Recipes</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Your cookbook. Add ingredients once, use them across many recipes.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkelCard key={i} />
        ))}
        <div className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-transparent flex flex-col items-center justify-center p-6 min-h-[14rem] text-[var(--muted)]">
          <Plus size={32} className="mb-2" />
          <span className="font-serif text-lg">Add new recipe</span>
        </div>
      </div>
    </main>
  );
}
