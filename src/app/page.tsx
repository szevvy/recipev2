export default function HomePage() {
  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recipe Planner</h1>
        <form action="/logout" method="post">
          <button
            type="submit"
            className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="rounded-xl border border-black/10 dark:border-white/10 p-6 bg-white dark:bg-neutral-900">
        <p className="text-neutral-600 dark:text-neutral-400">
          Phase 1 scaffold is live. Up next: ingredients, recipes, meal plan, shopping list.
        </p>
      </section>
    </main>
  );
}
