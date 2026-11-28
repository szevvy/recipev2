"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { RefreshCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { BOOTSTRAP_KEY, type BootstrapData } from "@/lib/queries";
import { refreshPricesAction, type RefreshPricesResult } from "./actions";

type WaitingState =
  | { kind: "idle" }
  | { kind: "waiting"; triggeredAt: number; referenceIso: string | null; runId: string }
  | { kind: "done"; runId: string; finishedIso: string }
  | { kind: "timeout" }
  | { kind: "error"; message: string };

export function RefreshPricesButton({
  initialLastRefreshedAt,
}: {
  initialLastRefreshedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<WaitingState>({ kind: "idle" });
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(
    initialLastRefreshedAt,
  );
  const qc = useQueryClient();
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }

  useEffect(() => clearTimers, []);

  function latestFetchedAt(): string | null {
    const bootstrap = qc.getQueryData<BootstrapData>(BOOTSTRAP_KEY);
    const rows = bootstrap?.prices ?? [];
    let best: string | null = null;
    for (const r of rows) {
      if (!best || r.fetched_at > best) best = r.fetched_at;
    }
    return best;
  }

  function onClick() {
    clearTimers();
    setState({ kind: "idle" });
    startTransition(async () => {
      const r: RefreshPricesResult = await refreshPricesAction();
      if (!r.ok) {
        setState({ kind: "error", message: r.error });
        return;
      }
      const referenceIso = latestFetchedAt();
      const triggeredAt = Date.now();
      setState({ kind: "waiting", triggeredAt, referenceIso, runId: r.runId });

      // Poll bootstrap every 8s for up to 3 minutes. When the newest
      // fetched_at is strictly greater than the pre-trigger reference,
      // we know the webhook has written and the UI can stop waiting.
      pollTimerRef.current = setInterval(async () => {
        await qc.refetchQueries({ queryKey: BOOTSTRAP_KEY });
        const newest = latestFetchedAt();
        if (newest && (!referenceIso || newest > referenceIso)) {
          clearTimers();
          setLastRefreshedAt(newest);
          setState({ kind: "done", runId: r.runId, finishedIso: newest });
        }
      }, 8_000);
      timeoutTimerRef.current = setTimeout(() => {
        clearTimers();
        setState((prev) =>
          prev.kind === "waiting" ? { kind: "timeout" } : prev,
        );
      }, 180_000);
    });
  }

  const busy = pending || state.kind === "waiting";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm px-4 py-2 hover:bg-[var(--surface-muted)] disabled:opacity-60 transition-colors"
        >
          <RefreshCcw size={14} className={busy ? "animate-spin" : ""} />
          {busy ? "Refreshing prices…" : "Refresh prices now"}
        </button>
        <LastRefreshedLabel iso={lastRefreshedAt} />
      </div>
      {state.kind === "waiting" && (
        <p className="text-xs italic text-[var(--muted)]">
          Apify run started — polling for the result. Usually completes
          in 30–60 seconds; checking every 8s.
        </p>
      )}
      {state.kind === "done" && (
        <p className="text-xs text-[var(--sage)]">
          Prices refreshed.
        </p>
      )}
      {state.kind === "timeout" && (
        <p className="text-xs text-amber-700">
          Still running after 3 minutes — the webhook may land soon.
          Reload the page later to see the latest timestamp.
        </p>
      )}
      {state.kind === "error" && (
        <p className="text-xs text-red-600">Error: {state.message}</p>
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
