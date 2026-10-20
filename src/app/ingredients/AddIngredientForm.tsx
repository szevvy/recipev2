"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { StarToggleHidden } from "@/components/StarButton";
import { GroupCombobox } from "@/components/GroupCombobox";
import { createIngredientAction, type ActionResult } from "./actions";

async function wrappedAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return createIngredientAction(fd);
}

export function AddIngredientForm({ groupSuggestions }: { groupSuggestions: string[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    wrappedAction,
    null,
  );
  const [isStaple, setIsStaple] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setIsStaple(false);
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-2xl border border-[var(--border)] p-4 bg-[var(--surface)] shadow-sm space-y-3"
    >
      <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
        Add ingredient
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1.5fr_auto_auto] gap-2 items-end">
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Name</span>
          <input
            name="name"
            required
            maxLength={80}
            className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
          />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Unit</span>
          <input
            name="default_unit"
            maxLength={20}
            placeholder="g, cup, …"
            className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
          />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Group</span>
          <div className="mt-0.5">
            <GroupCombobox
              name="group_name"
              suggestions={groupSuggestions}
              placeholder="e.g. Produce"
            />
          </div>
        </label>
        <StarToggleHidden
          name="is_staple"
          checked={isStaple}
          onChange={setIsStaple}
          size={22}
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] text-white text-sm px-3 py-1.5 disabled:opacity-60 hover:bg-[var(--accent-hover)] transition-colors"
        >
          <Plus size={16} />
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
