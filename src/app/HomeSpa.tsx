"use client";

import { useEffect, useState } from "react";
import { LogOut, Menu, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useBootstrap } from "@/lib/queries";
import { TabButton } from "./_tabs/TabButton";
import { ShoppingTab } from "./_tabs/ShoppingTab";
import { PlanTab } from "./_tabs/PlanTab";
import { RecipesTab } from "./_tabs/RecipesTab";
import { IngredientsTab } from "./_tabs/IngredientsTab";

type TabId = "shopping" | "plan" | "recipes" | "ingredients";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "shopping", label: "Shopping" },
  { id: "plan", label: "Plan" },
  { id: "recipes", label: "Recipes" },
  { id: "ingredients", label: "Ingredients" },
];

function readInitialTab(): TabId {
  if (typeof window === "undefined") return "shopping";
  const param = new URLSearchParams(window.location.search).get("tab");
  if (TABS.some((t) => t.id === param)) return param as TabId;
  return "shopping";
}

export function HomeSpa() {
  const [tab, setTab] = useState<TabId>(() => readInitialTab());
  const bootstrap = useBootstrap();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const current = new URLSearchParams(window.location.search).get("tab");
    if (current !== tab) {
      const url = `${window.location.pathname}?tab=${tab}`;
      window.history.replaceState({}, "", url);
    }
  }, [tab]);

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
    <header className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-[var(--border)]">
      <div className="flex items-baseline gap-6">
        <button
          type="button"
          onClick={() => onChangeTab("shopping")}
          className="font-serif text-2xl text-[var(--accent)] font-semibold"
        >
          Kitchen
        </button>
        <nav className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
          {TABS.map((t) => (
            <TabButton
              key={t.id}
              label={t.label}
              active={t.id === tab}
              onClick={() => onChangeTab(t.id)}
            />
          ))}
        </nav>
      </div>
      <div className="relative">
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
