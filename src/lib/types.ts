export type StapleState = "not_checked" | "need" | "have";

export type Ingredient = {
  id: string;
  name: string;
  default_unit: string | null;
  group_name: string | null;
  is_staple: boolean;
  staple_state: StapleState;
  created_at: string;
  updated_at: string;
};
