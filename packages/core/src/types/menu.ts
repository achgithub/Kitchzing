export type Allergen =
  | "celery"
  | "gluten"
  | "crustaceans"
  | "eggs"
  | "fish"
  | "lupin"
  | "milk"
  | "molluscs"
  | "mustard"
  | "nuts"
  | "peanuts"
  | "sesame"
  | "soya"
  | "sulphites";

export const ALL_ALLERGENS: Allergen[] = [
  "celery", "gluten", "crustaceans", "eggs", "fish", "lupin",
  "milk", "molluscs", "mustard", "nuts", "peanuts", "sesame",
  "soya", "sulphites",
];

export type OptionGroupType = "single" | "multi";

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  display_order: number;
  active: boolean;
  items: MenuItem[];
}

export interface MenuItem {
  id: string;
  category_id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: number;
  in_stock: boolean;
  active: boolean;
  display_order: number;
  allergens: Allergen[];
  option_groups: OptionGroup[];
}

export interface OptionGroup {
  id: string;
  item_id: string;
  name: string;
  type: OptionGroupType;
  required: boolean;
  display_order: number;
  choices: OptionChoice[];
}

export interface OptionChoice {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  in_stock: boolean;
  allergens: Allergen[];
}
