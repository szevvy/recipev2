"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export function GroupCombobox({
  name,
  defaultValue = "",
  suggestions,
  placeholder,
  maxLength = 50,
}: {
  name: string;
  defaultValue?: string;
  suggestions: string[];
  placeholder?: string;
  maxLength?: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const query = value.trim().toLowerCase();
  const filtered = query
    ? suggestions.filter((s) => s.toLowerCase().includes(query) && s.toLowerCase() !== query)
    : suggestions.filter((s) => s.length > 0);

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        name={name}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            e.stopPropagation();
          }
        }}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] pl-2 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show groups"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
          inputRef.current?.focus();
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ChevronDown size={16} />
      </button>
      {open && filtered.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg z-20 py-1">
          {filtered.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setValue(s);
                  setOpen(false);
                  inputRef.current?.focus();
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-soft)] text-sm"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
