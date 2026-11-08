"use client";

import { useState, useTransition } from "react";
import { Boxes } from "lucide-react";
import { rebuildPantryFromShoppedMealsAction } from "./pantry-actions";

export function RebuildPantryButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function onClick() {
    if (
      !confirm(
        "Scan recently-shopped meals and add their ingredients to Already have (pantry) if they aren't already there?",
      )
    )
      return;
    setMessage(null);
    startTransition(async () => {
      const result = await rebuildPantryFromShoppedMealsAction();
      if (!result.ok) {
        setMessage(`Error: ${result.error}`);
        return;
      }
      setMessage(
        result.added > 0
          ? `Added ${result.added} ${result.added === 1 ? "item" : "items"} to pantry.`
          : "Nothing to add — your pantry is already in sync.",
      );
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm px-4 py-2 hover:bg-[var(--surface-muted)] disabled:opacity-60 transition-colors"
      >
        <Boxes size={14} />
        {pending ? "Rebuilding…" : "Rebuild pantry from shopped meals"}
      </button>
      {message && (
        <p
          className={
            "text-xs " +
            (message.startsWith("Error") ? "text-red-600" : "text-[var(--muted)]")
          }
        >
          {message}
        </p>
      )}
    </div>
  );
}
