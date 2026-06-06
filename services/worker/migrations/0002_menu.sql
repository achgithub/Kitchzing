-- Phase 2: menu tables

CREATE TABLE menu_categories (
  id            TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE menu_items (
  id            TEXT PRIMARY KEY,
  category_id   TEXT NOT NULL REFERENCES menu_categories(id),
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price         INTEGER NOT NULL DEFAULT 0,
  in_stock      INTEGER NOT NULL DEFAULT 1,
  active        INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE menu_item_allergens (
  item_id   TEXT NOT NULL REFERENCES menu_items(id),
  allergen  TEXT NOT NULL,
  PRIMARY KEY (item_id, allergen)
);

CREATE TABLE option_groups (
  id            TEXT PRIMARY KEY,
  item_id       TEXT NOT NULL REFERENCES menu_items(id),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'single',
  required      INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE option_choices (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES option_groups(id),
  name        TEXT NOT NULL,
  price_delta INTEGER NOT NULL DEFAULT 0,
  in_stock    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE option_choice_allergens (
  choice_id TEXT NOT NULL REFERENCES option_choices(id),
  allergen  TEXT NOT NULL,
  PRIMARY KEY (choice_id, allergen)
);

CREATE INDEX idx_menu_items_category    ON menu_items(category_id);
CREATE INDEX idx_menu_items_restaurant  ON menu_items(restaurant_id);
CREATE INDEX idx_option_groups_item     ON option_groups(item_id);
CREATE INDEX idx_option_choices_group   ON option_choices(group_id);
