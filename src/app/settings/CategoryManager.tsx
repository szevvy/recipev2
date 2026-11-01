"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, GripVertical, X } from "lucide-react";
import { CATEGORY_PALETTE, paletteColor } from "@/lib/category-palette";
import {
  setCategoryColorAction,
  setCategoryOrderAction,
} from "./category-actions";

export type CategoryRow = {
  name: string;
  color: string | null;
};

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const [order, setOrder] = useState<CategoryRow[]>(categories);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    setOrder(categories);
  }, [categories]);

  function persistOrder(next: CategoryRow[]) {
    setOrder(next);
    const names = next.map((c) => c.name);
    startTransition(async () => {
      const result = await setCategoryOrderAction(names);
      if (!result.ok) setError(result.error);
    });
  }

  function setColor(name: string, color: string | null) {
    setOrder((prev) => prev.map((c) => (c.name === name ? { ...c, color } : c)));
    startTransition(async () => {
      const result = await setCategoryColorAction(name, color);
      if (!result.ok) setError(result.error);
    });
  }

  function move(from: number, to: number) {
    if (from === to) return;
    const next = [...order];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    persistOrder(next);
  }

  if (order.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)] italic">
        No categories yet. Set a <strong>Group</strong> on any ingredient and it
        shows up here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {order.map((cat, idx) => (
          <li
            key={cat.name}
            draggable
            onDragStart={() => setDragIndex(idx)}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragIndex === null || dragIndex === idx) return;
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) move(dragIndex, idx);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            className={
              "flex items-center gap-2 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] p-2 " +
              (dragIndex === idx ? "opacity-50" : "")
            }
          >
            <button
              type="button"
              className="cursor-grab text-[var(--muted)] hover:text-[var(--foreground)]"
              title="Drag to reorder"
            >
              <GripVertical size={14} />
            </button>
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => idx > 0 && move(idx, idx - 1)}
                disabled={idx === 0}
                className="h-6 w-6 inline-flex items-center justify-center rounded-full text-xs text-[var(--muted)] hover:bg-[var(--surface)] disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => idx < order.length - 1 && move(idx, idx + 1)}
                disabled={idx === order.length - 1}
                className="h-6 w-6 inline-flex items-center justify-center rounded-full text-xs text-[var(--muted)] hover:bg-[var(--surface)] disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move down"
              >
                ↓
              </button>
            </div>
            <CategoryName name={cat.name} color={cat.color} />
            <div className="ml-auto">
              <ColorPickerButton
                name={cat.name}
                color={cat.color}
                onChange={(next) => setColor(cat.name, next)}
              />
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function CategoryName({ name, color }: { name: string; color: string | null }) {
  const c = paletteColor(color);
  if (!c) {
    return <span className="text-sm text-[var(--foreground)] font-medium">{name}</span>;
  }
  return (
    <span
      className="inline-flex items-center text-sm font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: c.chipBg, color: c.chipText }}
    >
      {name}
    </span>
  );
}

function ColorPickerButton({
  name,
  color,
  onChange,
}: {
  name: string;
  color: string | null;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = paletteColor(color);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 h-7 pl-1.5 pr-1 rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--muted)] hover:border-[var(--accent)]"
      >
        <span
          className="h-4 w-4 rounded-full border border-black/10"
          style={{ backgroundColor: current?.chipBg ?? "#ececec" }}
        />
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg p-2 z-30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--muted)]">Color for {name}</span>
            {color && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-red-600"
                title="Clear color"
              >
                <X size={12} /> clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-6 gap-1">
            {CATEGORY_PALETTE.map((c) => {
              const active = c.token === color;
              return (
                <button
                  key={c.token}
                  type="button"
                  onClick={() => {
                    onChange(c.token);
                    setOpen(false);
                  }}
                  title={c.label}
                  className={
                    "h-7 w-7 rounded-full border transition-transform " +
                    (active
                      ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40 scale-105"
                      : "border-black/10 hover:scale-105")
                  }
                  style={{ backgroundColor: c.chipBg }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
