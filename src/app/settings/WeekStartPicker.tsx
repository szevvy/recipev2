"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { setWeekStartAction } from "./actions";

const DAYS: { value: 0 | 1; label: string; detail: string }[] = [
  { value: 1, label: "Monday", detail: "ISO standard; weekend at the end" },
  { value: 0, label: "Sunday", detail: "US-style" },
];

export function WeekStartPicker({ initial }: { initial: number }) {
  const [current, setCurrent] = useState<number>(initial);
  const [savedTick, setSavedTick] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pick(day: number) {
    if (day === current) return;
    const previous = current;
    setCurrent(day);
    setError(null);
    startTransition(async () => {
      const result = await setWeekStartAction(day);
      if (!result.ok) {
        setCurrent(previous);
        setError(result.error);
        return;
      }
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1200);
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {DAYS.map((d) => {
          const active = d.value === current;
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => pick(d.value)}
              disabled={pending}
              className={
                "text-left rounded-xl border p-3 transition-colors " +
                (active
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] bg-[var(--surface-muted)] hover:border-[var(--accent)]/50")
              }
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--foreground)]">{d.label}</span>
                {active && <Check size={16} className="text-[var(--accent)]" />}
              </div>
              <div className="text-xs text-[var(--muted)] mt-0.5">{d.detail}</div>
            </button>
          );
        })}
      </div>
      {savedTick && <p className="text-xs text-[var(--sage)]">Saved.</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
