-- Phase 1: core auth tables

CREATE TABLE restaurants (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  tier        TEXT NOT NULL DEFAULT 'starter',
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

CREATE TABLE staff (
  id            TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name          TEXT NOT NULL,
  pin_hash      TEXT NOT NULL,
  default_role  TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE devices (
  id            TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name          TEXT NOT NULL,
  last_seen     INTEGER NOT NULL,
  registered_at INTEGER NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE recovery_codes (
  id            TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  code_hash     TEXT NOT NULL,
  used          INTEGER NOT NULL DEFAULT 0,
  used_at       INTEGER
);

CREATE TABLE audit_log (
  id            TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  staff_id      TEXT,
  device_id     TEXT,
  action        TEXT NOT NULL,
  entity_id     TEXT,
  old_value     TEXT,
  new_value     TEXT,
  created_at    INTEGER NOT NULL
);

-- Phase 1: order tables

CREATE TABLE orders (
  id            TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  created_by    TEXT NOT NULL REFERENCES staff(id),
  table_ref     TEXT NOT NULL,
  delivery_mode TEXT NOT NULL DEFAULT 'together',
  status        TEXT NOT NULL DEFAULT 'open',
  created_at    INTEGER NOT NULL
);

CREATE TABLE order_items (
  id                TEXT PRIMARY KEY,
  order_id          TEXT NOT NULL REFERENCES orders(id),
  menu_item_id      TEXT,
  name              TEXT NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 1,
  notes             TEXT NOT NULL DEFAULT '',
  allergy_note      TEXT NOT NULL DEFAULT '',
  state             TEXT NOT NULL DEFAULT 'new',
  state_updated_by  TEXT,
  state_updated_at  INTEGER
);

CREATE TABLE order_item_choices (
  id            TEXT PRIMARY KEY,
  order_item_id TEXT NOT NULL REFERENCES order_items(id),
  choice_id     TEXT NOT NULL,
  name          TEXT NOT NULL,
  price_delta   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_orders_restaurant ON orders(restaurant_id, status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
