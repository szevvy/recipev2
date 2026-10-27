"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ChevronDown, HelpCircle, ShoppingBasket } from "lucide-react";
import type { Ingredient, StapleState } from "@/lib/types";
import { setStapleStateAction } from "./actions";

type Staple = Pick<Ingredient, "id" | "name" | "staple_state">;

export function StaplePreCheck({ staples }: { staples: Staple[] }) {
  const [open, setOpen] = useState(false);
  const needCount = staples.filter((s) => s.staple_state === "need").length;
  const haveCount = staples.filter((s) => s.staple_state === "have").length;
  const unchecked = staples.length - needCount - haveCount;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-[var(--surface-muted)] transition-colors"
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 className="font-serif text-lg text-[var(--foreground)]">Staples to check</h2>
          {staples.length > 0 && (
            <span className="text-xs text-[var(--muted)] truncate">
              {unchecked > 0 && <span>{unchecked} to check</span>}
              {unchecked > 0 && needCount > 0 && <span> · </span>}
              {needCount > 0 && (
                <span className="text-[var(--accent)]">{needCount} need</span>
              )}
              {(unchecked > 0 || needCount > 0) && haveCount > 0 && <span> · </span>}
              {haveCount > 0 && <span className="text-[var(--sage)]">{haveCount} have</span>}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={
            "text-[var(--muted)] shrink-0 transition-transform " +
            (open ? "rotate-180" : "")
          }
        />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-[var(--border)]/60 pt-3">
          {staples.length === 0 ? (
            <p className="text-sm text-[var(--muted)] italic">
              No staples yet. Star ingredients on the Ingredients page to add them here.
            </p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {staples.map((s) => (
                <StapleRow key={s.id} staple={s} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function StapleRow({ staple }: { staple: Staple }) {
  const [state, setState] = useState<StapleState>(staple.staple_state);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(staple.staple_state);
  }, [staple.staple_state]);

  function pick(next: StapleState) {
    const previous = state;
    const resolved = state === next ? "not_checked" : next;
    setState(resolved);
    setError(null);
    startTransition(async () => {
      const result = await setStapleStateAction(staple.id, resolved);
      if (!result.ok) {
        setState(previous);
        setError(result.error);
      }
    });
  }

  const base =
    "inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors text-xs";

  return (
    <li className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-[var(--surface-muted)]">
      <span
        className={
          "shrink-0 " +
          (state === "need"
            ? "text-[var(--accent)]"
            : state === "have"
            ? "text-[var(--sage)]"
            : "text-stone-300")
        }
      >
        {state === "have" ? (
          <Check size={16} />
        ) : state === "need" ? (
          <ShoppingBasket size={16} />
        ) : (
          <HelpCircle size={16} />
        )}
      </span>
      <span className="flex-1 text-sm text-[var(--foreground)] truncate">{staple.name}</span>
      <button
        type="button"
        onClick={() => pick("need")}
        title="Need to buy"
        className={
          base +
          " " +
          (state === "need"
            ? "bg-[var(--accent)] text-white"
            : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]")
        }
      >
        <ShoppingBasket size={14} />
      </button>
      <button
        type="button"
        onClick={() => pick("have")}
        title="Already have"
        className={
          base +
          " " +
          (state === "have"
            ? "bg-[var(--sage)] text-white"
            : "text-[var(--muted)] hover:bg-[var(--sage)]/15 hover:text-[var(--sage)]")
        }
      >
        <Check size={14} />
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </li>
  );
}
