"use client";

import { useEffect, useState, useTransition } from "react";
import { ChefHat, Pencil, Trash2, Check, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Ingredient,
  IngredientPrice,
  PriceDisplay,
  Recipe,
  Retailer,
} from "@/lib/types";
import { ListPicker } from "@/components/ListPicker";
import { LinkedRecipePicker } from "@/components/LinkedRecipePicker";
import { GroupCombobox } from "@/components/GroupCombobox";
import { PriceChips } from "@/components/PriceChips";
import { IngredientPricesDetail } from "@/components/IngredientPricesDetail";
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

type RowAccent = { chipBg: string; chipText: string } | null;

export function IngredientRow({
  ingredient,
  groupSuggestions,
  knownLists,
  recipes,
  accent,
}: {
  ingredient: Ingredient;
  groupSuggestions: string[];
  knownLists: string[];
  recipes: RecipeOption[];
  accent?: RowAccent;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
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
    function parseCodes(raw: string): string[] {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const part of raw.split(/[,\s]+/)) {
        const trimmed = part.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        out.push(trimmed);
      }
      return out;
    }
    const nextRetailerCodes = {
      coles: parseCodes(String(fd.get("retailer_coles") ?? "")),
      woolworths: parseCodes(String(fd.get("retailer_woolworths") ?? "")),
      aldi: parseCodes(String(fd.get("retailer_aldi") ?? "")),
    };
    function parseWeight(raw: string): number | null {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const n = Number.parseInt(trimmed, 10);
      return Number.isFinite(n) && n > 0 && n <= 100_000 ? n : null;
    }
    const nextRetailerWeights = {
      coles: parseWeight(String(fd.get("weight_g_coles") ?? "")),
      woolworths: parseWeight(String(fd.get("weight_g_woolworths") ?? "")),
      aldi: parseWeight(String(fd.get("weight_g_aldi") ?? "")),
    };
    const rawDisplay = String(fd.get("price_display_override") ?? "").trim();
    const nextPriceDisplayOverride: PriceDisplay | null =
      rawDisplay === "pack" ||
      rawDisplay === "per_kg" ||
      rawDisplay === "both"
        ? rawDisplay
        : null;
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
                retailer_weights: nextRetailerWeights,
                price_display_override: nextPriceDisplayOverride,
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
            <label className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <span>Price display</span>
              <select
                name="price_display_override"
                defaultValue={ingredient.price_display_override ?? ""}
                title="Overrides the group default. Leave on 'Group default' for most ingredients."
                className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
              >
                <option value="">Group default</option>
                <option value="pack">Pack only</option>
                <option value="per_kg">$/kg only</option>
                <option value="both">Both</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span className="w-20 shrink-0">Coles IDs</span>
              <input
                name="retailer_coles"
                defaultValue={ingredient.retailer_codes.coles.join(", ")}
                placeholder="e.g. 329607, 440010"
                title="Comma-separated when the same ingredient covers multiple SKUs"
                className="flex-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span className="w-20 shrink-0">Woolies IDs</span>
              <input
                name="retailer_woolworths"
                defaultValue={ingredient.retailer_codes.woolworths.join(", ")}
                placeholder="e.g. 12345, 67890"
                title="Comma-separated when the same ingredient covers multiple SKUs"
                className="flex-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
              />
            </label>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--muted)]">
              Unit weight — fill any two to auto-derive the third. Only weight
              is saved; we use it to compute $/kg when the retailer only
              lists an each price.
            </p>
            <RetailerWeightInput
              retailer="coles"
              label="Coles"
              ingredientId={ingredient.id}
              initialWeightG={ingredient.retailer_weights?.coles ?? null}
            />
            <RetailerWeightInput
              retailer="woolworths"
              label="Woolies"
              ingredientId={ingredient.id}
              initialWeightG={ingredient.retailer_weights?.woolworths ?? null}
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

  const hasAnyCode =
    ingredient.retailer_codes.coles.length > 0 ||
    ingredient.retailer_codes.woolworths.length > 0 ||
    ingredient.retailer_codes.aldi.length > 0;

  const expandedBgStyle =
    expanded && accent
      ? { backgroundColor: `${accent.chipBg}8f` }
      : undefined;
  const hoverTintClass = accent ? "" : " hover:bg-[var(--surface-muted)]";
  const nameStyle = accent ? { color: `${accent.chipText}d9` } : undefined;

  return (
    <li
      className={
        "rounded-lg transition-colors " +
        (expanded && !accent ? "bg-[var(--surface-muted)]" : hoverTintClass)
      }
      style={expandedBgStyle}
    >
      <div
        className="flex items-center gap-2 px-2 py-1.5"
        onMouseEnter={(e) => {
          if (!expanded && accent) {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = `${accent.chipBg}77`;
          }
        }}
        onMouseLeave={(e) => {
          if (accent) {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = "";
          }
        }}
      >
        <ListPicker
          lists={ingredient.lists}
          knownLists={knownLists}
          onToggle={onListToggle}
        />
        <button
          type="button"
          onClick={() => hasAnyCode && setExpanded((e) => !e)}
          className={
            "flex-1 min-w-0 text-left " +
            (hasAnyCode ? "cursor-pointer" : "cursor-default")
          }
          aria-expanded={expanded}
        >
          <div
            className="font-medium truncate flex items-center gap-1 text-sm"
            style={nameStyle ?? { color: "var(--foreground)" }}
          >
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
        </button>
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
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-[var(--border)]/60">
          <IngredientPricesDetail ingredientId={ingredient.id} />
        </div>
      )}
    </li>
  );
}

// Three linked inputs (weight / each / $per-kg) for one retailer. Any two
// filled auto-derive the third on blur. Only weight is persisted — the
// $ fields are convenience helpers pre-filled from the current cheapest
// in-stock variant so the user can read off the retailer's site and let
// the derivation compute the weight for them.
function RetailerWeightInput({
  retailer,
  label,
  ingredientId,
  initialWeightG,
}: {
  retailer: Retailer;
  label: string;
  ingredientId: string;
  initialWeightG: number | null;
}) {
  const qc = useQueryClient();
  const bootstrap = qc.getQueryData<BootstrapData>(BOOTSTRAP_KEY);
  const relevant = (bootstrap?.prices ?? []).filter(
    (p: IngredientPrice) =>
      p.ingredient_id === ingredientId && p.retailer === retailer && p.in_stock,
  );
  // Cheapest in-stock variant by unit price (fall back to pack) — same
  // rule the chips use for picking the retailer's representative price.
  const best = relevant
    .slice()
    .sort((a, b) => {
      const au = a.unit_price_cents ?? a.price_cents ?? Number.MAX_SAFE_INTEGER;
      const bu = b.unit_price_cents ?? b.price_cents ?? Number.MAX_SAFE_INTEGER;
      return au - bu;
    })[0];
  const initialEach =
    best?.price_cents != null ? (best.price_cents / 100).toFixed(2) : "";
  const initialPerKg =
    best?.unit_price_cents != null && best?.unit_of_measure === "kg"
      ? (best.unit_price_cents / 100).toFixed(2)
      : "";

  const [weight, setWeight] = useState<string>(
    initialWeightG != null ? String(initialWeightG) : "",
  );
  const [each, setEach] = useState<string>(initialEach);
  const [perKg, setPerKg] = useState<string>(initialPerKg);

  function recompute(changed: "weight" | "each" | "perKg") {
    const w = Number.parseFloat(weight);
    const e = Number.parseFloat(each);
    const k = Number.parseFloat(perKg);
    const hasW = Number.isFinite(w) && w > 0;
    const hasE = Number.isFinite(e) && e > 0;
    const hasK = Number.isFinite(k) && k > 0;

    // Only derive the one that's still blank. Leaves user-entered values
    // alone so a later price update doesn't silently overwrite the weight.
    if (changed === "weight" && hasW) {
      if (hasE && !hasK) setPerKg(((e / w) * 1000).toFixed(2));
      else if (!hasE && hasK) setEach((k * (w / 1000)).toFixed(2));
    } else if (changed === "each" && hasE) {
      if (hasW && !hasK) setPerKg(((e / w) * 1000).toFixed(2));
      else if (!hasW && hasK) setWeight(String(Math.round((e / k) * 1000)));
    } else if (changed === "perKg" && hasK) {
      if (hasW && !hasE) setEach((k * (w / 1000)).toFixed(2));
      else if (!hasW && hasE) setWeight(String(Math.round((e / k) * 1000)));
    }
  }

  const inputCls =
    "w-16 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] tabular-nums";

  return (
    <div className="flex items-center gap-2 text-xs text-[var(--muted)] flex-wrap">
      <span className="w-20 shrink-0">{label}</span>
      <label className="inline-flex items-center gap-1">
        <input
          type="number"
          name={`weight_g_${retailer}`}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={() => recompute("weight")}
          min={1}
          step={1}
          placeholder="—"
          className={inputCls}
        />
        <span>g</span>
      </label>
      <label className="inline-flex items-center gap-1">
        <span>$</span>
        <input
          type="number"
          value={each}
          onChange={(e) => setEach(e.target.value)}
          onBlur={() => recompute("each")}
          min={0}
          step={0.01}
          placeholder="—"
          className={inputCls}
        />
        <span>each</span>
      </label>
      <label className="inline-flex items-center gap-1">
        <span>$</span>
        <input
          type="number"
          value={perKg}
          onChange={(e) => setPerKg(e.target.value)}
          onBlur={() => recompute("perKg")}
          min={0}
          step={0.01}
          placeholder="—"
          className={inputCls}
        />
        <span>/kg</span>
      </label>
    </div>
  );
}
