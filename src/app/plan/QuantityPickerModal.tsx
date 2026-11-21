"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// Small modal for picking "I need to buy N of this" quantity when
// reviewing a staple / list ingredient. Quick-picks 2..5 + a free input.
export function QuantityPickerModal({
  open,
  itemName,
  defaultQuantity = 2,
  onPick,
  onClose,
}: {
  open: boolean;
  itemName: string;
  defaultQuantity?: number;
  onPick: (quantity: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState<string>(String(defaultQuantity));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(String(defaultQuantity));
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, defaultQuantity, onClose]);

  if (!open) return null;

  function submit() {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1) return;
    onPick(n);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-2xl bg-[var(--background)] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 p-3 border-b border-[var(--border)]">
          <h2 className="font-serif text-base text-[var(--foreground)] truncate">
            How many {itemName}?
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
            title="Close"
          >
            <X size={14} />
          </button>
        </header>
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onPick(n)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] py-1.5 text-sm hover:bg-[var(--accent-soft)] hover:border-[var(--accent)] transition-colors"
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={submit}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-[var(--accent)] text-white text-sm px-3 py-1.5 hover:bg-[var(--accent-hover)] transition-colors"
            >
              Need {value || "?"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
