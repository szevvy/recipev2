"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, HelpCircle, Home, ShoppingBasket } from "lucide-react";
import type { ShoppingItemState } from "@/lib/types";

type PickState = Exclude<ShoppingItemState, "bought">;

type Option = {
  value: PickState;
  label: string;
  Icon: typeof HelpCircle;
  activeClass: string;
  textClass: string;
};

const OPTIONS: Option[] = [
  {
    value: "not_checked",
    label: "Not reviewed",
    Icon: HelpCircle,
    // Faint pink tint so unreviewed items are noticeable without screaming.
    activeClass: "bg-red-50 text-red-500 border-red-200",
    textClass: "text-red-500",
  },
  {
    value: "have",
    label: "Already have",
    Icon: Home,
    activeClass:
      "bg-[var(--surface-muted)] text-[var(--sage)] border-[var(--border)]",
    textClass: "text-[var(--sage)]",
  },
  {
    value: "to_buy",
    label: "Need to buy",
    Icon: ShoppingBasket,
    activeClass:
      "bg-[var(--surface-muted)] text-[var(--accent)] border-[var(--border)]",
    textClass: "text-[var(--accent)]",
  },
];

export function StatePicker({
  state,
  onChange,
}: {
  state: ShoppingItemState;
  onChange: (next: PickState) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // 'bought' shows as neutral — the bought check is the control for that state.
  const current =
    state === "bought"
      ? null
      : OPTIONS.find((o) => o.value === state) ?? OPTIONS[0];

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          "inline-flex items-center gap-1 h-7 pl-1.5 pr-1 rounded-full border transition-colors " +
          (current
            ? current.activeClass
            : "border-[var(--border)] text-[var(--muted)] bg-transparent hover:bg-[var(--surface-muted)]")
        }
      >
        {current ? <current.Icon size={14} /> : <HelpCircle size={14} />}
        <ChevronDown size={12} />
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1 z-30"
        >
          {OPTIONS.map((opt) => {
            const active = state === opt.value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--accent-soft)]"
                >
                  <opt.Icon size={14} className={opt.textClass} />
                  <span className="flex-1 text-[var(--foreground)]">{opt.label}</span>
                  {active && <Check size={14} className="text-[var(--muted)]" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
