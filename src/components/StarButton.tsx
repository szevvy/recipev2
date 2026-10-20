"use client";

import { Star } from "lucide-react";

export function StarButton({
  active,
  onToggle,
  disabled,
  size = 20,
  title,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: number;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={title ?? (active ? "Unmark as staple" : "Mark as staple")}
      aria-pressed={active}
      className="inline-flex items-center justify-center p-1 rounded-full transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-50"
    >
      <Star
        size={size}
        strokeWidth={2}
        className={
          active
            ? "fill-[var(--staple)] text-[var(--staple)]"
            : "text-stone-300 hover:text-[var(--staple)]"
        }
      />
    </button>
  );
}

export function StarToggleHidden({
  name,
  checked,
  onChange,
  size = 20,
  title,
}: {
  name: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  size?: number;
  title?: string;
}) {
  return (
    <label
      className="inline-flex items-center justify-center p-1 rounded-full cursor-pointer transition-colors hover:bg-[var(--accent-soft)]"
      title={title ?? (checked ? "Staple (click to unmark)" : "Mark as staple")}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <Star
        size={size}
        strokeWidth={2}
        className={
          checked
            ? "fill-[var(--staple)] text-[var(--staple)]"
            : "text-stone-300 hover:text-[var(--staple)]"
        }
      />
    </label>
  );
}
