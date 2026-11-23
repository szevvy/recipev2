"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChefHat,
  Check,
  ChevronDown,
  Clock,
  HelpCircle,
  Home,
  Package,
  ShoppingBasket,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { ShoppingItemState } from "@/lib/types";

type PickState = Exclude<ShoppingItemState, "bought">;

type Option = {
  value: PickState;
  label: string;
  Icon: typeof HelpCircle;
  activeClass: string;
  textClass: string;
};

const NOT_CHECKED: Option = {
  value: "not_checked",
  label: "Not reviewed",
  Icon: HelpCircle,
  // Faint pink tint so unreviewed items are noticeable without screaming.
  activeClass: "bg-red-50 text-red-500 border-red-200",
  textClass: "text-red-500",
};

const HAVE: Option = {
  value: "have",
  label: "Already have",
  Icon: Home,
  activeClass:
    "bg-[var(--surface-muted)] text-[var(--sage)] border-[var(--border)]",
  textClass: "text-[var(--sage)]",
};

const TO_BUY: Option = {
  value: "to_buy",
  label: "Need to buy",
  Icon: ShoppingBasket,
  activeClass:
    "bg-[var(--surface-muted)] text-[var(--accent)] border-[var(--border)]",
  textClass: "text-[var(--accent)]",
};

const NEED_TO_MAKE: Option = {
  value: "need_to_make",
  label: "Need to make",
  Icon: ChefHat,
  activeClass:
    "bg-[var(--surface-muted)] text-[var(--accent)] border-[var(--border)]",
  textClass: "text-[var(--accent)]",
};

const LATER: Option = {
  value: "later",
  label: "Later",
  Icon: Clock,
  // Muted / deferred — no bright colour, same visual weight as 'bought'
  // but without the strikethrough on the row.
  activeClass:
    "bg-[var(--surface-muted)] text-[var(--muted)] border-[var(--border)]",
  textClass: "text-[var(--muted)]",
};

export function StatePicker({
  state,
  onChange,
  onRemove,
  canMake = false,
  variant = "shopping",
  onNeedMore,
  onPromoteToIngredient,
}: {
  state: ShoppingItemState;
  onChange: (next: PickState) => void;
  onRemove?: () => void;
  // true when the backing ingredient has a linked_recipe_id — swaps the
  // Need-to-buy slot for Need-to-make.
  canMake?: boolean;
  // "shopping" (default) shows Later in the fourth slot. "list" hides Later
  // (doesn't make sense when reviewing staples/custom lists on the plan)
  // and offers "Need to buy 2+" that opens a quantity picker via onNeedMore.
  variant?: "shopping" | "list";
  onNeedMore?: () => void;
  // Set on one-off shopping rows ({ name }) to offer "Add as ingredient"
  // — promotes the row into the library + links it.
  onPromoteToIngredient?: () => void;
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

  const buyOrMake = canMake ? NEED_TO_MAKE : TO_BUY;
  const OPTIONS: Option[] =
    variant === "list"
      ? [NOT_CHECKED, HAVE, buyOrMake]
      : [NOT_CHECKED, HAVE, buyOrMake, LATER];

  // When an item is bought, keep showing the buy/make chip (basket/chef) so
  // the picker always reflects a real option.
  const displayValue: PickState =
    state === "bought" ? buyOrMake.value : (state as PickState);
  const current = OPTIONS.find((o) => o.value === displayValue) ?? OPTIONS[0];

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          "inline-flex items-center gap-1 h-7 pl-1.5 pr-1 rounded-full border transition-colors " +
          current.activeClass
        }
      >
        <current.Icon size={14} />
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
          {onPromoteToIngredient && (
            <li className="border-t border-[var(--border)]/60 mt-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  onPromoteToIngredient();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--accent-soft)]"
              >
                <Sparkles size={14} className="text-[var(--accent)]" />
                <span className="flex-1 text-[var(--foreground)]">
                  Add as ingredient…
                </span>
              </button>
            </li>
          )}
          {variant === "list" && onNeedMore && (
            <li>
              <button
                type="button"
                onClick={() => {
                  onNeedMore();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--accent-soft)]"
              >
                <Package size={14} className="text-[var(--accent)]" />
                <span className="flex-1 text-[var(--foreground)]">
                  Need to buy 2+…
                </span>
              </button>
            </li>
          )}
          {onRemove && (
            <li className="border-t border-[var(--border)]/60 mt-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  onRemove();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
                <span className="flex-1">Remove from list</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
