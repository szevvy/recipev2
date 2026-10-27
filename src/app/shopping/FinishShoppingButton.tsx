"use client";

import { useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { finishShoppingAction } from "./actions";

export function FinishShoppingButton() {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("Finish shopping? This clears bought items and resets staples.")) return;
    startTransition(async () => {
      await finishShoppingAction();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sage)] text-white text-sm px-4 py-2 hover:brightness-110 disabled:opacity-60 transition-all"
    >
      <CheckCircle2 size={16} /> {pending ? "Finishing…" : "Finish shopping"}
    </button>
  );
}
