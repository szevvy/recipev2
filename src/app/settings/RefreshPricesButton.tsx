"use client";

import { useEffect, useState, useTransition } from "react";
import { RefreshCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { BOOTSTRAP_KEY } from "@/lib/queries";
import { refreshPricesAction, type RefreshPricesResult } from "./actions";

export function RefreshPricesButton({
  initialLastRefreshedAt,
}: {
  initialLastRefreshedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RefreshPricesResult | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(
    initialLastRefreshedAt,
  );
  const qc = useQueryClient();

  function onClick() {
    setResult(null);
    startTransition(async () => {
      const r = await refreshPricesAction();
      setResult(r);
      if (r.ok) {
        setLastRefreshedAt(new Date().toISOString());
        qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY });
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onClick}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm px-4 py-2 hover:bg-[var(--surface-muted)] disabled:opacity-60 transition-colors"
        >
          <RefreshCcw size={14} className={pending ? "animate-spin" : ""} />
          {pending ? "Fetching prices…" : "Refresh prices now"}
        </button>
        <LastRefreshedLabel iso={lastRefreshedAt} />
      </div>
      {result && !result.ok && (
        <p className="text-xs text-red-600">Error: {result.error}</p>
      )}
      {result && result.ok && (
        <>
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
          {result.warnings && result.warnings.length > 0 && (
            <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {pending && (
        <p className="text-xs italic text-[var(--muted)]">
          Apify usually takes 30–60 seconds for a full run — hang tight.
        </p>
      )}
    </div>
  );
}

// Renders a relative "last refreshed X ago" label that ticks without
// re-fetching. Mounts empty to avoid SSR/client hydration mismatch —
// the absolute timestamp sits in the title attribute for anyone who
// wants the precise moment.
function LastRefreshedLabel({ iso }: { iso: string | null }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!iso) {
      setLabel(null);
      return;
    }
    const d = new Date(iso);
    function update() {
      const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
      if (s < 45) return setLabel("just now");
      const m = Math.round(s / 60);
      if (m < 60) return setLabel(`${m} minute${m === 1 ? "" : "s"} ago`);
      const h = Math.round(m / 60);
      if (h < 24) return setLabel(`${h} hour${h === 1 ? "" : "s"} ago`);
      const days = Math.round(h / 24);
      if (days < 30) return setLabel(`${days} day${days === 1 ? "" : "s"} ago`);
      setLabel(d.toLocaleDateString());
    }
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [iso]);

  if (!iso) {
    return (
      <span className="text-xs italic text-[var(--muted)]">Never refreshed</span>
    );
  }
  return (
    <span
      className="text-xs text-[var(--muted)]"
      title={new Date(iso).toLocaleString()}
    >
      Last refreshed {label ?? "…"}
    </span>
  );
}
