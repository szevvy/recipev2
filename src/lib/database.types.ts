import type {
  AppSettings,
  Ingredient,
  MealPlanEntry,
  PurchaseHistoryRow,
  Recipe,
  RecipeIngredient,
  ShoppingItem,
  ShoppingItemSource,
  ShoppingItemSourceKind,
  ShoppingItemSourceRow,
  ShoppingItemState,
  StapleState,
  WeekStart,
} from "./types";

type IngredientInsert = {
  id?: string;
  name: string;
  group_name?: string | null;
  is_staple?: boolean;
  staple_state?: StapleState;
};

type IngredientUpdate = Partial<Omit<Ingredient, "id" | "created_at" | "updated_at">>;

type RecipeInsert = {
  id?: string;
  name: string;
  instructions?: string | null;
  source_url?: string | null;
  default_servings?: number;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  image_url?: string | null;
  notes?: string | null;
};

type RecipeUpdate = Partial<Omit<Recipe, "id" | "created_at" | "updated_at">>;

type RecipeIngredientInsert = {
  id?: string;
  recipe_id: string;
  ingredient_id: string;
  quantity?: string | null;
  note?: string | null;
  sort_order?: number;
};

export type Database = {
  public: {
    Tables: {
      ingredients: {
        Row: Ingredient;
        Insert: IngredientInsert;
        Update: IngredientUpdate;
        Relationships: [];
      };
      recipes: {
        Row: Recipe;
        Insert: RecipeInsert;
        Update: RecipeUpdate;
        Relationships: [];
      };
      recipe_ingredients: {
        Row: RecipeIngredient;
        Insert: RecipeIngredientInsert;
        Update: Partial<RecipeIngredientInsert>;
        Relationships: [];
      };
      app_settings: {
        Row: AppSettings;
        Insert: { id?: number; week_starts_on?: WeekStart };
        Update: { week_starts_on?: WeekStart };
        Relationships: [];
      };
      meal_plan: {
        Row: MealPlanEntry;
        Insert: {
          id?: string;
          date: string;
          recipe_id: string;
          servings?: number | null;
          slot?: string | null;
          shopped_at?: string | null;
        };
        Update: {
          date?: string;
          recipe_id?: string;
          servings?: number | null;
          slot?: string | null;
          shopped_at?: string | null;
        };
        Relationships: [];
      };
      shopping_items: {
        Row: ShoppingItem;
        Insert: {
          id?: string;
          ingredient_id: string;
          quantity?: string | null;
          source: ShoppingItemSource;
          source_ref?: string | null;
          state?: ShoppingItemState;
          notes?: string | null;
        };
        Update: {
          quantity?: string | null;
          state?: ShoppingItemState;
          notes?: string | null;
        };
        Relationships: [];
      };
      shopping_item_sources: {
        Row: ShoppingItemSourceRow;
        Insert: {
          id?: string;
          shopping_item_id: string;
          kind: ShoppingItemSourceKind;
          meal_plan_id?: string | null;
          quantity?: string | null;
        };
        Update: {
          quantity?: string | null;
        };
        Relationships: [];
      };
      purchase_history: {
        Row: PurchaseHistoryRow;
        Insert: {
          id?: string;
          ingredient_id: string;
          quantity?: string | null;
          purchased_at?: string;
        };
        Update: {
          quantity?: string | null;
          purchased_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
