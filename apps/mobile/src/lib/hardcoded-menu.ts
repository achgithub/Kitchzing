// Phase 1 hardcoded menu — replaced by GET /menu in Phase 2
export interface HardcodedItem {
  id: string;
  name: string;
  price: number;
  allergens: string[];
}

export interface HardcodedCategory {
  id: string;
  name: string;
  items: HardcodedItem[];
}

export const HARDCODED_MENU: HardcodedCategory[] = [
  {
    id: "starters",
    name: "Starters",
    items: [
      { id: "s1", name: "Soup of the day", price: 595, allergens: ["gluten", "milk"] },
      { id: "s2", name: "Garlic bread", price: 395, allergens: ["gluten", "milk"] },
      { id: "s3", name: "Chicken wings", price: 795, allergens: [] },
    ],
  },
  {
    id: "mains",
    name: "Mains",
    items: [
      { id: "m1", name: "Burger", price: 1295, allergens: ["gluten", "eggs"] },
      { id: "m2", name: "Fish & chips", price: 1395, allergens: ["gluten", "fish"] },
      { id: "m3", name: "Veggie pasta", price: 1095, allergens: ["gluten", "milk", "eggs"] },
      { id: "m4", name: "Steak", price: 2195, allergens: [] },
    ],
  },
  {
    id: "sides",
    name: "Sides",
    items: [
      { id: "si1", name: "Chips", price: 395, allergens: [] },
      { id: "si2", name: "Side salad", price: 395, allergens: [] },
      { id: "si3", name: "Onion rings", price: 395, allergens: ["gluten"] },
    ],
  },
  {
    id: "drinks",
    name: "Drinks",
    items: [
      { id: "d1", name: "Soft drink", price: 295, allergens: [] },
      { id: "d2", name: "Beer", price: 495, allergens: ["gluten"] },
      { id: "d3", name: "House wine (glass)", price: 595, allergens: ["sulphites"] },
    ],
  },
];
