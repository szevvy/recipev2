import { AppHeader } from "@/components/AppHeader";

function SkelLine({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[var(--border)]/70 ${className}`} />
  );
}

function SkelGroup() {
  return (
    <section className="space-y-2">
      <SkelLine className="h-5 w-32" />
      <ul className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm divide-y divide-[var(--border)]/60 p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-center gap-2 px-2 py-1.5">
            <div className="h-7 w-7 rounded-full bg-[var(--border)]/60 animate-pulse" />
            <SkelLine className="h-4 flex-1" />
          </li>
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
        <SkelLine className="h-4 w-96 mt-2" />
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-4 h-20 animate-pulse" />
      <div className="space-y-6">
        <SkelGroup />
        <SkelGroup />
      </div>
    </main>
  );
}
