import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ChefHat } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <AppHeader current="/" />
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <ChefHat className="text-[var(--accent)]" size={32} />
          <h1 className="text-3xl font-serif text-[var(--foreground)]">Welcome home</h1>
        </div>
        <p className="text-[var(--muted)] mb-6 max-w-prose">
          Build out your ingredient library, then recipes and the shopping list follow.
        </p>
        <div className="flex gap-3">
          <Link
            href="/ingredients"
            className="inline-flex items-center rounded-full bg-[var(--accent)] text-white text-sm px-4 py-2 hover:bg-[var(--accent-hover)] transition-colors"
          >
            Manage ingredients
          </Link>
        </div>
      </section>
    </main>
  );
}
