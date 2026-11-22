"use client";

import { useState, useTransition } from "react";
import { setPostcodeAction } from "./actions";

export function PostcodeInput({ initial }: { initial: string | null }) {
  const [value, setValue] = useState<string>(initial ?? "");
  const [savedTick, setSavedTick] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (value === (initial ?? "")) return;
    setError(null);
    startTransition(async () => {
      const result = await setPostcodeAction(value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1200);
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          inputMode="numeric"
          maxLength={4}
          placeholder="e.g. 2000"
          disabled={pending}
          className="w-28 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
        />
        {savedTick && <span className="text-xs text-[var(--sage)]">Saved.</span>}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
