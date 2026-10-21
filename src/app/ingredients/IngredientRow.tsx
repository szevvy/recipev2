"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import type { Ingredient } from "@/lib/types";
import { StarButton, StarToggleHidden } from "@/components/StarButton";
import { GroupCombobox } from "@/components/GroupCombobox";
import {
  deleteIngredientAction,
  toggleStapleAction,
  updateIngredientAction,
} from "./actions";

export function IngredientRow({
  ingredient,
  groupSuggestions,
}: {
  ingredient: Ingredient;
  groupSuggestions: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [editStaple, setEditStaple] = useState(ingredient.is_staple);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openEdit() {
    setEditStaple(ingredient.is_staple);
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  function onSave(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateIngredientAction(ingredient.id, fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  function onDelete() {
    if (!confirm(`Delete "${ingredient.name}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteIngredientAction(ingredient.id);
      if (!result.ok) setError(result.error);
    });
  }

  function onToggleStaple() {
    setError(null);
    startTransition(async () => {
      const result = await toggleStapleAction(ingredient.id, !ingredient.is_staple);
      if (!result.ok) setError(result.error);
    });
  }

  if (editing) {
    return (
      <li className="rounded-xl bg-[var(--accent-soft)]/60 p-3 ring-1 ring-[var(--accent)]/30">
        <form action={onSave} className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1.5fr_auto] gap-2 items-end">
            <label className="block">
              <span className="text-xs text-[var(--muted)]">Name</span>
              <input
                name="name"
                defaultValue={ingredient.name}
                required
                maxLength={80}
                className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--muted)]">Group</span>
              <div className="mt-0.5">
                <GroupCombobox
                  name="group_name"
                  defaultValue={ingredient.group_name ?? ""}
                  suggestions={groupSuggestions}
                />
              </div>
            </label>
            <StarToggleHidden
              name="is_staple"
              checked={editStaple}
              onChange={setEditStaple}
              size={22}
            />
          </div>
          <div className="flex gap-2 justify-end items-center">
            {error && <p className="text-xs text-red-600 mr-auto">{error}</p>}
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white text-sm px-3 py-1 hover:bg-[var(--surface-muted)]"
            >
              <X size={14} /> Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] text-white text-sm px-3 py-1 disabled:opacity-60 hover:bg-[var(--accent-hover)] transition-colors"
            >
              <Check size={14} /> {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-lg hover:bg-[var(--surface-muted)] px-2 py-1.5 transition-colors">
      <StarButton active={ingredient.is_staple} onToggle={onToggleStaple} disabled={pending} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[var(--foreground)] truncate">{ingredient.name}</div>
      </div>
      {error && <span className="text-xs text-red-600 mr-1">{error}</span>}
      <button
        onClick={openEdit}
        title="Edit"
        className="p-1.5 rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors"
      >
        <Pencil size={16} />
      </button>
      <button
        onClick={onDelete}
        disabled={pending}
        title="Delete"
        className="p-1.5 rounded-full text-[var(--muted)] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        <Trash2 size={16} />
      </button>
    </li>
  );
}
