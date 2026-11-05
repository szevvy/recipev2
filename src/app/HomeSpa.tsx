"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { BOOTSTRAP_KEY, useBootstrap } from "@/lib/queries";
import { TabButton } from "./_tabs/TabButton";
import { ShoppingTab } from "./_tabs/ShoppingTab";
import { PlanTab } from "./_tabs/PlanTab";
import { RecipesTab } from "./_tabs/RecipesTab";
import { IngredientsTab } from "./_tabs/IngredientsTab";

export type TabId = "shopping" | "plan" | "recipes" | "ingredients";

const TABS: Array<{ id: TabId; label: string; path: string }> = [
  { id: "shopping", label: "Shopping", path: "/shopping" },
  { id: "plan", label: "Plan", path: "/plan" },
  { id: "recipes", label: "Recipes", path: "/recipes" },
  { id: "ingredients", label: "Ingredients", path: "/ingredients" },
];

function tabFromPathname(pathname: string): TabId {
  for (const t of TABS) if (pathname.startsWith(t.path)) return t.id;
  return "shopping";
}

export function HomeSpa({ initialTab }: { initialTab: TabId }) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const bootstrap = useBootstrap();
  const qc = useQueryClient();
  const firstTabRender = useRef(true);

  // Keep the URL + local state in sync as the user switches tabs and uses
  // browser back/forward. Each tab is its own history entry (pushState) so
  // navigation feels like real routes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const current = tabFromPathname(window.location.pathname);
    if (current !== tab) {
      const target = TABS.find((t) => t.id === tab);
      if (target) {
        window.history.pushState({ tab }, "", target.path);
      }
    }
  }, [tab]);

  // Any time the user navigates to a tab, fetch fresh bootstrap in the
  // background. /api/bootstrap runs syncShoppingList() first, so visiting
  // Shopping after adding a meal on Plan picks up the new items. React Query
  // keeps serving cached data until the new payload arrives, then stable row
  // keys turn the swap into an in-place add/remove/update (preserves scroll).
  useEffect(() => {
    if (firstTabRender.current) {
      // useBootstrap's own first fetch covers the initial render.
      firstTabRender.current = false;
      return;
    }
    qc.refetchQueries({ queryKey: BOOTSTRAP_KEY });
  }, [tab, qc]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onPop() {
      setTab(tabFromPathname(window.location.pathname));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto space-y-6">
      <ShellHeader tab={tab} onChangeTab={setTab} />
      {bootstrap.isPending ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5">
          <p className="text-sm text-[var(--muted)] italic">Loading your kitchen…</p>
        </section>
      ) : bootstrap.isError ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5">
          <p className="text-sm text-red-600">
            Couldn&apos;t load: {(bootstrap.error as Error).message}
          </p>
        </section>
      ) : (
        <>
          <div hidden={tab !== "shopping"}>
            <ShoppingTab data={bootstrap.data} />
          </div>
          <div hidden={tab !== "plan"}>
            <PlanTab data={bootstrap.data} />
          </div>
          <div hidden={tab !== "recipes"}>
            <RecipesTab data={bootstrap.data} />
          </div>
          <div hidden={tab !== "ingredients"}>
            <IngredientsTab data={bootstrap.data} />
          </div>
        </>
      )}
    </main>
  );
}

function ShellHeader({
  tab,
  onChangeTab,
}: {
  tab: TabId;
  onChangeTab: (t: TabId) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 pb-5 mb-6 border-b border-[var(--border)]">
      <button
        type="button"
        onClick={() => onChangeTab("shopping")}
        className="font-serif text-2xl text-[var(--accent)] font-semibold w-full sm:w-auto text-left"
      >
        Kitchen
      </button>
      <nav className="flex flex-wrap items-baseline gap-x-4 sm:gap-x-5 gap-y-1 text-sm">
        {TABS.map((t) => (
          <TabButton
            key={t.id}
            label={t.label}
            active={t.id === tab}
            onClick={() => onChangeTab(t.id)}
          />
        ))}
      </nav>
      <div className="relative ml-auto">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors"
          title="Menu"
        >
          <Menu size={18} />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1 z-30"
          >
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
            >
              <SettingsIcon size={14} /> Settings
            </Link>
            <form action="/logout" method="post" role="menuitem">
              <button
                type="submit"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
              >
                <LogOut size={14} /> Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
