"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Home, PencilLine, ShoppingBasket, Sparkles, Utensils } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { ShoppingItemState, ShoppingItemWithIngredient } from "@/lib/types";
import { useInvalidateBootstrap } from "@/lib/queries";
import {
  removeShoppingItemAction,
  setItemNotesAction,
  setItemStateAction,
} from "./actions";
import { StatePicker } from "./StatePicker";

export type RowAccent = { chipBg: string; chipText: string } | null;

export function ShoppingItemRow({
  item,
  expanded,
  onToggleExpand,
  accent,
}: {
  item: ShoppingItemWithIngredient;
  expanded: boolean;
  onToggleExpand: () => void;
  accent?: RowAccent;
}) {
  const [state, setState] = useState<ShoppingItemState>(item.state);
  const [removed, setRemoved] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateBootstrap();

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
        return;
      }
      invalidate();
    });
  }

  function remove() {
    setRemoved(true);
    startTransition(async () => {
      const result = await removeShoppingItemAction(item.id);
      if (!result.ok) {
        setRemoved(false);
        setError(result.error);
        return;
      }
      invalidate();
    });
  }

  if (removed) return null;
  // Instant hide when the user picks 'have' — the server round-trip plus full
  // page revalidate was taking a visible beat before the row disappeared.
  if (state === "have") return null;

  const isBought = state === "bought";
  const notes = item.notes?.trim() ?? "";

  const expandedRingStyle = expanded && accent
    ? { backgroundColor: `${accent.chipBg}8f`, boxShadow: `inset 0 0 0 1px ${accent.chipText}26` }
    : undefined;
  const hoverTintClass = accent ? "" : " hover:bg-[var(--surface-muted)]";
  const nameStyle = accent ? { color: `${accent.chipText}d9` } : undefined;

  return (
    <li
      className={
        "rounded-lg transition-colors " +
        (expanded && !accent ? "bg-[var(--accent-soft)]/40 ring-1 ring-[var(--accent)]/20" : "")
      }
      style={expandedRingStyle}
    >
      <div
        className={
          "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors cursor-pointer " +
          (isBought ? "opacity-50" : "") +
          (expanded ? "" : hoverTintClass)
        }
        onMouseEnter={(e) => {
          if (!expanded && accent) {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = `${accent.chipBg}77`;
          }
        }}
        onMouseLeave={(e) => {
          if (accent) {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = "";
          }
        }}
        onClick={(e) => {
          // Only expand/collapse when clicking the "body" area, not when a nested
          // interactive (bought check, picker chevron) was clicked.
          if ((e.target as HTMLElement).closest("button,input,textarea")) return;
          onToggleExpand();
        }}
      >
        <BoughtButton
          active={isBought}
          onClick={() => update(isBought ? "to_buy" : "bought")}
        />
        <div className="flex-1 min-w-0">
          <span
            className={"text-sm " + (isBought ? "line-through" : "")}
            style={nameStyle ?? { color: "var(--foreground)" }}
          >
            {item.quantity ? <span className="font-medium">{item.quantity} </span> : null}
            {item.ingredients?.name ?? item.name ?? "(unknown)"}
          </span>
          {notes && !expanded && (
            <div className="text-xs italic text-[var(--muted)] mt-0.5 truncate flex items-center gap-1">
              <PencilLine size={10} /> {notes}
            </div>
          )}
        </div>
        {error && <span className="text-xs text-red-600 mr-1">{error}</span>}
        <StatePicker state={state} onChange={update} onRemove={remove} />
      </div>
      {expanded && <ExpandedPanel item={item} />}
    </li>
  );
}

function BoughtButton({ active, onClick }: { active: boolean; onClick: () => void }) {
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

function ExpandedPanel({ item }: { item: ShoppingItemWithIngredient }) {
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();
  const invalidate = useInvalidateBootstrap();

  useEffect(() => {
    setNotes(item.notes ?? "");
  }, [item.notes]);

  function commitNotes() {
    const nextTrim = notes.trim();
    const currentTrim = (item.notes ?? "").trim();
    if (nextTrim === currentTrim) return;
    startTransition(async () => {
      const result = await setItemNotesAction(item.id, nextTrim);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
        invalidate();
      }
    });
  }

  const sources = item.shopping_item_sources ?? [];

  return (
    <div className="px-3 pb-3 pt-1 space-y-3 border-t border-[var(--border)]/60">
      <label className="block">
        <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
          Note
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={commitNotes}
          rows={2}
          placeholder="e.g. buy on Thursday"
          className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
        />
        {saved && <span className="text-xs text-[var(--sage)]">Saved.</span>}
      </label>

      <div>
        {sources.length === 0 ? (
          <p className="text-xs italic text-[var(--muted)]">
            No source info recorded for this row.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-[var(--foreground)]">
                <SourceIcon kind={s.kind} />
                <span className="font-medium">{s.quantity ?? "–"}</span>
                <span>{sourceLabel(s)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SourceIcon({ kind }: { kind: "meal" | "staple" | "manual" }) {
  if (kind === "meal") return <Utensils size={12} className="text-[var(--muted)]" />;
  if (kind === "staple") return <Sparkles size={12} className="text-[var(--muted)]" />;
  return <ShoppingBasket size={12} className="text-[var(--accent)]" />;
}

function sourceLabel(s: ShoppingItemWithIngredient["shopping_item_sources"][number]): string {
  if (s.kind === "staple") return "from staples";
  if (s.kind === "manual") return "manually added";
  const name = s.meal_plan?.recipes?.name;
  const dateIso = s.meal_plan?.date;
  const day = dateIso ? format(parseISO(dateIso), "EEE d MMM") : null;
  if (name && day) return `from ${name} (${day})`;
  if (name) return `from ${name}`;
  return "from a planned meal";
}

export function HaveRow({ item }: { item: ShoppingItemWithIngredient }) {
  const [moving, setMoving] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateBootstrap();

  function moveToBuy() {
    setMoving(true);
    startTransition(async () => {
      const result = await setItemStateAction(item.id, "to_buy");
      if (!result.ok) {
        setMoving(false);
        setError(result.error);
        return;
      }
      invalidate();
    });
  }

  if (moving) return null;

  return (
    <li className="flex items-center gap-2 py-1 text-sm">
      <Home size={12} className="text-[var(--sage)]/70 shrink-0" />
      <span className="flex-1 truncate text-[var(--muted)]">
        {item.quantity ? <span>{item.quantity} </span> : null}
        {item.ingredients?.name ?? item.name ?? "(unknown)"}
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
