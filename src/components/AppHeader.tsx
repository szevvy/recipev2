import Link from "next/link";
import { HeaderMenu } from "./HeaderMenu";

const navItems: { href: string; label: string; disabled?: boolean }[] = [
  { href: "/", label: "Home" },
  { href: "/shopping", label: "Shopping" },
  { href: "/plan", label: "Plan" },
  { href: "/recipes", label: "Recipes" },
  { href: "/ingredients", label: "Ingredients" },
];

export function AppHeader({ current }: { current: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-[var(--border)]">
      <div className="flex items-baseline gap-6">
        <Link href="/" className="font-serif text-2xl text-[var(--accent)] font-semibold">
          Kitchen
        </Link>
        <nav className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
          {navItems.slice(1).map((item) => {
            const isCurrent = item.href === current;
            if (item.disabled) {
              return (
                <span
                  key={item.href}
                  className="grid text-stone-400 cursor-not-allowed"
                  title="Coming soon"
                >
                  <span aria-hidden className="row-start-1 col-start-1 font-semibold invisible">
                    {item.label}
                  </span>
                  <span className="row-start-1 col-start-1 text-center">
                    {item.label}
                  </span>
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className="grid"
              >
                <span
                  aria-hidden
                  className="row-start-1 col-start-1 font-semibold invisible"
                >
                  {item.label}
                </span>
                <span
                  className={
                    "row-start-1 col-start-1 text-center transition-colors " +
                    (isCurrent
                      ? "font-semibold text-[var(--accent)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]")
                  }
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
      <HeaderMenu />
    </header>
  );
}
