"use client";

import { useEffect, useState, useTransition } from "react";
import { ChefHat, Pencil, Trash2, Check, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Ingredient, Recipe } from "@/lib/types";
import { ListPicker } from "@/components/ListPicker";
import { LinkedRecipePicker } from "@/components/LinkedRecipePicker";
import { GroupCombobox } from "@/components/GroupCombobox";
import { PriceChips } from "@/components/PriceChips";
import {
  BOOTSTRAP_KEY,
  useInvalidateBootstrap,
  type BootstrapData,
} from "@/lib/queries";
import {
  addIngredientToListAction,
  deleteIngredientAction,
  removeIngredientFromListAction,
  updateIngredientAction,
} from "./actions";

type RecipeOption = Pick<
  Recipe,
  "id" | "name" | "image_url" | "default_servings" | "prep_minutes" | "cook_minutes"
>;

export function IngredientRow({
  ingredient,
  groupSuggestions,
  knownLists,
  recipes,
}: {
  ingredient: Ingredient;
  groupSuggestions: string[];
  knownLists: string[];
  recipes: RecipeOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [editLists, setEditLists] = useState<string[]>(ingredient.lists);
  const [editLinkedRecipeId, setEditLinkedRecipeId] = useState<string | null>(
    ingredient.linked_recipe_id,
  );
  const [deletedLocal, setDeletedLocal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const invalidate = useInvalidateBootstrap();
  const qc = useQueryClient();

  useEffect(() => {
    if (!editing) {
      setEditLists(ingredient.lists);
      setEditLinkedRecipeId(ingredient.linked_recipe_id);
    }
  }, [ingredient.lists, ingredient.linked_recipe_id, editing]);

  function openEdit() {
    setEditLists(ingredient.lists);
    setEditLinkedRecipeId(ingredient.linked_recipe_id);
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  function onSave(fd: FormData) {
    const nextName = String(fd.get("name") ?? "").trim();
    const nextGroup = String(fd.get("group_name") ?? "").trim();
    if (!nextName) {
      setError("Name is required");
      return;
    }
    const nextLists = [...editLists].sort((a, b) => a.localeCompare(b));
    const nextLinkedRecipeId = editLinkedRecipeId;
    const nextRetailerCodes = {
      coles: String(fd.get("retailer_coles") ?? "").trim() || null,
      woolworths: String(fd.get("retailer_woolworths") ?? "").trim() || null,
      aldi: String(fd.get("retailer_aldi") ?? "").trim() || null,
    };
    const snapshot = qc.getQueryData<BootstrapData>(BOOTSTRAP_KEY);
    qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
      if (!old) return old;
      const next = old.ingredients
        .map((i) =>
          i.id === ingredient.id
            ? {
                ...i,
                name: nextName,
                group_name: nextGroup || null,
                lists: nextLists,
                linked_recipe_id: nextLinkedRecipeId,
                retailer_codes: nextRetailerCodes,
                updated_at: new Date().toISOString(),
              }
            : i,
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      return { ...old, ingredients: next };
    });
    setEditing(false);
    setError(null);

    startTransition(async () => {
      const result = await updateIngredientAction(ingredient.id, fd);
      if (!result.ok) {
        if (snapshot) qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, snapshot);
        else invalidate();
        setEditing(true);
        setError(result.error);
      }
    });
  }

  function onDelete() {
    if (!confirm(`Delete "${ingredient.name}"?`)) return;
    const snapshot = qc.getQueryData<BootstrapData>(BOOTSTRAP_KEY);
    setDeletedLocal(true);
    setError(null);
    qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
      if (!old) return old;
      return {
        ...old,
        ingredients: old.ingredients.filter((i) => i.id !== ingredient.id),
      };
    });

    startTransition(async () => {
      const result = await deleteIngredientAction(ingredient.id);
      if (!result.ok) {
        if (snapshot) qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, snapshot);
        else invalidate();
        setDeletedLocal(false);
        setError(result.error);
      }
    });
  }

  function patchListsInCache(nextLists: string[]) {
    qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
      if (!old) return old;
      return {
        ...old,
        ingredients: old.ingredients.map((i) =>
          i.id === ingredient.id ? { ...i, lists: nextLists } : i,
        ),
      };
    });
  }

  function onListToggle(listName: string, nowSelected: boolean) {
    const current = ingredient.lists;
    if (nowSelected && current.includes(listName)) return;
    if (!nowSelected && !current.includes(listName)) return;
    const next = nowSelected
      ? [...current, listName].sort((a, b) => a.localeCompare(b))
      : current.filter((l) => l !== listName);
    patchListsInCache(next);
    setError(null);
    startTransition(async () => {
      const result = nowSelected
        ? await addIngredientToListAction(ingredient.id, listName)
        : await removeIngredientFromListAction(ingredient.id, listName);
      if (!result.ok) {
        patchListsInCache(current);
        setError(result.error);
      }
    });
  }

  if (deletedLocal) return null;

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
            <ListPicker
              lists={editLists}
              knownLists={knownLists}
              onToggle={(name, nowSelected) => {
                setEditLists((prev) =>
                  nowSelected
                    ? Array.from(new Set([...prev, name]))
                    : prev.filter((l) => l !== name),
                );
              }}
              size={22}
            />
          </div>
          {editLists.map((l) => (
            <input key={l} type="hidden" name="lists" value={l} />
          ))}
          <input
            type="hidden"
            name="linked_recipe_id"
            value={editLinkedRecipeId ?? ""}
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <LinkedRecipePicker
              value={editLinkedRecipeId}
              recipes={recipes}
              onChange={setEditLinkedRecipeId}
            />
            <label className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <span>Shelf life</span>
              <input
                name="shelf_life_days"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                defaultValue={ingredient.shelf_life_days ?? ""}
                placeholder="—"
                title="1 = use the day you buy it, 2 = that day or next, etc. Blank = no limit."
                className="w-14 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
              />
              <span>days</span>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span className="w-20">Coles ID</span>
              <input
                name="retailer_coles"
                defaultValue={ingredient.retailer_codes.coles ?? ""}
                placeholder="e.g. 329607"
                className="flex-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span className="w-20">Woolies ID</span>
              <input
                name="retailer_woolworths"
                defaultValue={ingredient.retailer_codes.woolworths ?? ""}
                placeholder="e.g. 12345"
                className="flex-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
              />
            </label>
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
      <ListPicker
        lists={ingredient.lists}
        knownLists={knownLists}
        onToggle={onListToggle}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[var(--foreground)] truncate flex items-center gap-1">
          <span className="truncate">{ingredient.name}</span>
          {ingredient.linked_recipe_id && (
            <ChefHat
              size={12}
              className="text-[var(--accent)] shrink-0"
              aria-label="Make from recipe"
            />
          )}
        </div>
        <PriceChips ingredientId={ingredient.id} size="sm" />
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
