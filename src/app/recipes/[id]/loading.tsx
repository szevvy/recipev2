import { AppHeader } from "@/components/AppHeader";

function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[var(--border)]/70 ${className}`} />
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-4">
      <AppHeader current="/recipes" />
      <div className="flex items-center justify-between gap-4">
        <SkeletonLine className="h-5 w-24" />
        <SkeletonLine className="h-8 w-16" />
      </div>

      <article className="rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-sm overflow-hidden">
        <div className="h-56 sm:h-72 animate-pulse bg-[var(--accent-soft)]/60" />
        <div className="p-6 sm:p-10 space-y-8">
          <header className="space-y-4">
            <SkeletonLine className="h-10 sm:h-14 w-2/3" />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <SkeletonLine className="h-4 w-24" />
              <SkeletonLine className="h-4 w-32" />
              <SkeletonLine className="h-4 w-16" />
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-8 lg:gap-12">
            <section className="space-y-3">
              <SkeletonLine className="h-7 w-32" />
              <div className="space-y-2 pt-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonLine
                    key={i}
                    className="h-4"
                    {...{ style: { width: `${50 + ((i * 13) % 40)}%` } }}
                  />
                ))}
              </div>
            </section>
            <section className="space-y-3">
              <SkeletonLine className="h-7 w-24" />
              <div className="space-y-2 pt-1">
                <SkeletonLine className="h-4 w-full" />
                <SkeletonLine className="h-4 w-11/12" />
                <SkeletonLine className="h-4 w-10/12" />
                <SkeletonLine className="h-4 w-full" />
                <SkeletonLine className="h-4 w-9/12" />
                <SkeletonLine className="h-4 w-11/12" />
                <SkeletonLine className="h-4 w-8/12" />
                <SkeletonLine className="h-4 w-10/12" />
                <SkeletonLine className="h-4 w-11/12" />
                <SkeletonLine className="h-4 w-9/12" />
              </div>
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}
