import Link from "next/link";
import { HeaderMenu } from "./HeaderMenu";

const navItems: { href: string; label: string; disabled?: boolean }[] = [
  { href: "/", label: "Home" },
  { href: "/ingredients", label: "Ingredients" },
  { href: "/recipes", label: "Recipes" },
  { href: "/plan", label: "Plan" },
  { href: "/shopping", label: "Shopping", disabled: true },
];

export function AppHeader({ current }: { current: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-[var(--border)]">
      <div className="flex items-baseline gap-6">
        <Link href="/" className="font-serif text-2xl text-[var(--accent)] font-semibold">
          Kitchen
        </Link>
        <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {navItems.slice(1).map((item) => {
            const isCurrent = item.href === current;
            if (item.disabled) {
              return (
                <span
                  key={item.href}
                  className="text-stone-400 cursor-not-allowed"
                  title="Coming soon"
                >
                  {item.label}
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isCurrent
                    ? "font-semibold text-[var(--accent)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <HeaderMenu />
    </header>
  );
}
