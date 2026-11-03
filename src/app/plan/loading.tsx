import { AppHeader } from "@/components/AppHeader";
import { ChevronLeft, ChevronRight } from "lucide-react";

function SkelLine({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[var(--border)]/70 ${className}`} />
  );
}

function SkelDay() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2 min-h-[8rem]">
      <div>
        <SkelLine className="h-6 w-24" />
        <SkelLine className="h-3.5 w-20 mt-1" />
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
        <div>
          <h1 className="font-serif text-3xl text-[var(--foreground)]">Meal plan</h1>
          <SkelLine className="h-4 w-52 mt-2" />
        </div>
        <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm">
          <span className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full text-[var(--muted)]">
            <ChevronLeft size={14} /> Prev
          </span>
          <span className="px-3 py-1 text-sm rounded-full text-[var(--muted)]">
            This week
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full text-[var(--muted)]">
            Next <ChevronRight size={14} />
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkelDay key={i} />
        ))}
      </div>
    </main>
  );
}
