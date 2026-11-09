"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, Star } from "lucide-react";

// Star button with a small count badge. Click opens a dropdown where the
// user can tick ingredient-list memberships on/off and type a brand-new
// list name to create one. The component is controlled: pass the current
// memberships via `lists` and known list names via `knownLists`; the parent
// decides what to do on each toggle (optimistic server call, form state,
// etc.) via `onToggle`.
export function ListPicker({
  lists,
  knownLists,
  onToggle,
  disabled,
  size = 20,
}: {
  lists: string[];
  knownLists: string[];
  onToggle: (listName: string, nowSelected: boolean) => void;
  disabled?: boolean;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setDraft("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setDraft("");
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const normalizedLists = new Set(lists.map((l) => l.toLowerCase()));
  const options = Array.from(new Set([...knownLists, ...lists]))
    .sort((a, b) => {
      // "Staples" first, then alphabetical — matches plan tab ordering.
      if (a === "Staples") return -1;
      if (b === "Staples") return 1;
      return a.localeCompare(b);
    });
  const draftTrim = draft.trim();
  const draftExists = draftTrim
    ? options.some((o) => o.toLowerCase() === draftTrim.toLowerCase())
    : true;

  function commitDraft() {
    const name = draftTrim;
    if (!name || draftExists) return;
    onToggle(name, true);
    setDraft("");
    requestAnimationFrame(() => draftRef.current?.focus());
  }

  const count = lists.length;
  const isActive = count > 0;
  const starFill = isActive ? "var(--accent)" : "transparent";
  const starStroke = isActive ? "var(--accent)" : "var(--muted)";

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title={
          isActive
            ? `In ${count} list${count === 1 ? "" : "s"}: ${lists.join(", ")}`
            : "Add to a list"
        }
        className="relative inline-flex items-center justify-center p-1 rounded-full hover:bg-[var(--accent-soft)] disabled:opacity-50 transition-colors"
      >
        <Star size={size} color={starStroke} fill={starFill} strokeWidth={1.5} />
        {count > 1 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[1.1em] h-[1.1em] rounded-full bg-[var(--accent)] text-white text-[10px] leading-none font-semibold inline-flex items-center justify-center px-0.5"
            aria-hidden
          >
            {count}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1 z-30"
        >
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs italic text-[var(--muted)]">
              No lists yet — type one below.
            </p>
          ) : (
            <ul className="max-h-56 overflow-auto">
              {options.map((name) => {
                const selected = normalizedLists.has(name.toLowerCase());
                return (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => onToggle(name, !selected)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--accent-soft)]"
                    >
                      <span
                        className={
                          "inline-flex items-center justify-center h-4 w-4 rounded border transition-colors " +
                          (selected
                            ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                            : "border-[var(--border)] text-transparent")
                        }
                      >
                        <Check size={12} />
                      </span>
                      <span className="flex-1 text-[var(--foreground)] truncate">
                        {name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-[var(--border)]/60 mt-1 pt-1 px-2 pb-1">
            <div className="flex items-center gap-1">
              <input
                ref={draftRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitDraft();
                  }
                }}
                placeholder="Add a new list…"
                maxLength={60}
                className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={commitDraft}
                disabled={!draftTrim || draftExists}
                title="Create and add"
                className="inline-flex items-center justify-center h-7 w-7 rounded-full text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
