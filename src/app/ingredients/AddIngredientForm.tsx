"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ListPicker } from "@/components/ListPicker";
import { GroupCombobox } from "@/components/GroupCombobox";
import {
  BOOTSTRAP_KEY,
  useInvalidateBootstrap,
  type BootstrapData,
} from "@/lib/queries";
import type { Ingredient } from "@/lib/types";
import { createIngredientAction } from "./actions";

export function AddIngredientForm({
  groupSuggestions,
  knownLists,
}: {
  groupSuggestions: string[];
  knownLists: string[];
}) {
  const [lists, setLists] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const invalidate = useInvalidateBootstrap();
  const qc = useQueryClient();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      setError("Name is required");
      return;
    }
    const groupName = String(fd.get("group_name") ?? "").trim();
    const rowId = typeof crypto !== "undefined" ? crypto.randomUUID() : "";
    fd.set("id", rowId);

    const nowIso = new Date().toISOString();
    const newIng: Ingredient = {
      id: rowId,
      name,
      group_name: groupName || null,
      lists: [...lists].sort((a, b) => a.localeCompare(b)),
      staple_state: "not_checked",
      created_at: nowIso,
      updated_at: nowIso,
    };

    qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
      if (!old) return old;
      // Keep alphabetical so the new row lands where the list renders it.
      const next = [...old.ingredients, newIng].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      return { ...old, ingredients: next };
    });

    form.reset();
    setLists([]);
    setError(null);

    startTransition(async () => {
      const result = await createIngredientAction(fd);
      if (!result.ok) {
        qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
          if (!old) return old;
          return {
            ...old,
            ingredients: old.ingredients.filter((i) => i.id !== rowId),
          };
        });
        setError(result.error);
        invalidate();
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="rounded-2xl border border-[var(--border)] p-4 bg-[var(--surface)] shadow-sm space-y-3"
    >
      <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
        Add ingredient
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1.5fr_auto_auto] gap-2 items-end">
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
          <span className="text-xs text-[var(--muted)]">Group</span>
          <div className="mt-0.5">
            <GroupCombobox
              name="group_name"
              suggestions={groupSuggestions}
              placeholder="e.g. Produce"
            />
          </div>
        </label>
        <ListPicker
          lists={lists}
          knownLists={knownLists}
          onToggle={(name, nowSelected) =>
            setLists((prev) =>
              nowSelected
                ? Array.from(new Set([...prev, name]))
                : prev.filter((l) => l !== name),
            )
          }
          size={22}
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] text-white text-sm px-3 py-1.5 hover:bg-[var(--accent-hover)] transition-colors"
        >
          <Plus size={16} />
          Add
        </button>
      </div>
      {lists.map((l) => (
        <input key={l} type="hidden" name="lists" value={l} />
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
