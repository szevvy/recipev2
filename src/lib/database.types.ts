import type { Ingredient, StapleState } from "./types";

type IngredientInsert = {
  id?: string;
  name: string;
  default_unit?: string | null;
  group_name?: string | null;
  is_staple?: boolean;
  staple_state?: StapleState;
};

type IngredientUpdate = Partial<Omit<Ingredient, "id" | "created_at" | "updated_at">>;

export type Database = {
  public: {
    Tables: {
      ingredients: {
        Row: Ingredient;
        Insert: IngredientInsert;
        Update: IngredientUpdate;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
