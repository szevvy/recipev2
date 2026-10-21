import type {
  AppSettings,
  Ingredient,
  Recipe,
  RecipeIngredient,
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
  qty: number;
  unit?: string | null;
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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
