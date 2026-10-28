"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, HelpCircle, Home, ShoppingBasket, X } from "lucide-react";
import type { ShoppingItemState, ShoppingItemWithIngredient } from "@/lib/types";
import { removeShoppingItemAction, setItemStateAction } from "./actions";

export function ShoppingItemRow({ item }: { item: ShoppingItemWithIngredient }) {
  const [state, setState] = useState<ShoppingItemState>(item.state);
  const [removed, setRemoved] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(item.state);
  }, [item.state]);

  function update(next: ShoppingItemState) {
    if (next === state) return;
    const previous = state;
    setState(next);
    setError(null);
    startTransition(async () => {
      const result = await setItemStateAction(item.id, next);
      if (!result.ok) {
        setState(previous);
        setError(result.error);
      }
    });
  }

  function remove() {
    setRemoved(true);
    startTransition(async () => {
      const result = await removeShoppingItemAction(item.id);
      if (!result.ok) {
        setRemoved(false);
        setError(result.error);
      }
    });
  }

  if (removed) return null;

  const isBought = state === "bought";

  return (
    <li
      className={
        "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-[var(--surface-muted)]" +
        (isBought ? " opacity-50" : "")
      }
    >
      <BoughtButton
        active={isBought}
        onClick={() => update(isBought ? "to_buy" : "bought")}
      />
      <div className="flex-1 min-w-0">
        <span
          className={
            "text-sm text-[var(--foreground)] " + (isBought ? "line-through" : "")
          }
        >
          {item.quantity ? <span className="font-medium">{item.quantity} </span> : null}
          {item.ingredients?.name ?? "(unknown)"}
        </span>
        {item.source !== "meal" && (
          <span
            className={
              "ml-2 text-[10px] uppercase tracking-wide " +
              (item.source === "manual" ? "text-[var(--accent)]" : "text-[var(--muted)]")
            }
          >
            {item.source === "manual" ? "added" : "staple"}
          </span>
        )}
      </div>
      {error && <span className="text-xs text-red-600 mr-1">{error}</span>}
      <StatePicker state={state} onChange={update} />
      <button
        type="button"
        onClick={remove}
        title="Remove"
        className="p-1 rounded-full text-[var(--muted)] hover:text-red-600 hover:bg-red-50 transition-colors"
      >
        <X size={14} />
      </button>
    </li>
  );
}

export function StatePicker({
  state,
  onChange,
}: {
  state: ShoppingItemState;
  onChange: (next: ShoppingItemState) => void;
}) {
  const options: Array<{
    value: Exclude<ShoppingItemState, "bought">;
    title: string;
    icon: React.ReactNode;
    activeClass: string;
  }> = [
    {
      value: "not_checked",
      title: "Not checked yet",
      icon: <HelpCircle size={14} />,
      activeClass: "bg-stone-300 text-white",
    },
    {
      value: "have",
      title: "Already have",
      icon: <Home size={14} />,
      activeClass: "bg-[var(--sage)] text-white",
    },
    {
      value: "to_buy",
      title: "Need to buy",
      icon: <ShoppingBasket size={14} />,
      activeClass: "bg-[var(--accent)] text-white",
    },
  ];

  // When state === 'bought', none of the picker buttons is highlighted — the
  // bought check takes precedence; clicking any picker button also un-ticks.
  const activeKey = state === "bought" ? null : state;

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {options.map((opt) => {
        const active = activeKey === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.title}
            className={
              "inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors " +
              (active
                ? opt.activeClass
                : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]")
            }
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}

function BoughtButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? "Un-tick" : "Got it"}
      className={
        "inline-flex items-center justify-center h-7 w-7 rounded-full border transition-colors shrink-0 " +
        (active
          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
          : "border-[var(--border)] text-transparent hover:border-[var(--accent)] hover:text-[var(--accent)]")
      }
    >
      <Check size={14} />
    </button>
  );
}

export function HaveRow({ item }: { item: ShoppingItemWithIngredient }) {
  const [moving, setMoving] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function moveToBuy() {
    setMoving(true);
    startTransition(async () => {
      const result = await setItemStateAction(item.id, "to_buy");
      if (!result.ok) {
        setMoving(false);
        setError(result.error);
      }
    });
  }

  if (moving) return null;

  return (
    <li className="flex items-center gap-2 py-1 text-sm">
      <Home size={12} className="text-[var(--sage)]/70 shrink-0" />
      <span className="flex-1 truncate text-[var(--muted)]">
        {item.quantity ? <span>{item.quantity} </span> : null}
        {item.ingredients?.name ?? "(unknown)"}
      </span>
      <button
        type="button"
        onClick={moveToBuy}
        className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]"
      >
        add to list
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </li>
  );
}
