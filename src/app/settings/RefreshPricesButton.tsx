"use client";

import { useState, useTransition } from "react";
import { RefreshCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { BOOTSTRAP_KEY } from "@/lib/queries";
import { refreshPricesAction, type RefreshPricesResult } from "./actions";

export function RefreshPricesButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RefreshPricesResult | null>(null);
  const qc = useQueryClient();

  function onClick() {
    setResult(null);
    startTransition(async () => {
      const r = await refreshPricesAction();
      setResult(r);
      if (r.ok) qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY });
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
        <RefreshCcw size={14} className={pending ? "animate-spin" : ""} />
        {pending ? "Fetching prices…" : "Refresh prices now"}
      </button>
      {result && !result.ok && (
        <p className="text-xs text-red-600">Error: {result.error}</p>
      )}
      {result && result.ok && (
        <p className="text-xs text-[var(--muted)]">
          Checked {result.totals.requested} product
          {result.totals.requested === 1 ? "" : "s"}
          {" · "}
          {result.totals.updated} price
          {result.totals.updated === 1 ? "" : "s"} saved
          {result.totals.outOfStock > 0 && (
            <>
              {" · "}
              <span className="text-amber-700">
                {result.totals.outOfStock} out of stock
              </span>
            </>
          )}
          {" · "}
          <span className="italic">took {(result.durationMs / 1000).toFixed(1)}s</span>
        </p>
      )}
      {pending && (
        <p className="text-xs italic text-[var(--muted)]">
          Apify usually takes 30–60 seconds for a full run — hang tight.
        </p>
      )}
    </div>
  );
}
