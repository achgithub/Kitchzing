-- Menu seed for TEST-0001 (restaurant id: rest-001)
-- Safe to re-run: INSERT OR IGNORE throughout

-- Categories
INSERT OR IGNORE INTO menu_categories (id, restaurant_id, name, display_order) VALUES
  ('cat-starters',  'rest-001', 'Starters',      1),
  ('cat-burgers',   'rest-001', 'Burgers',        2),
  ('cat-mains',     'rest-001', 'Mains',          3),
  ('cat-sides',     'rest-001', 'Sides',          4),
  ('cat-desserts',  'rest-001', 'Desserts',       5),
  ('cat-drinks',    'rest-001', 'Soft Drinks',    6);

-- Items
INSERT OR IGNORE INTO menu_items (id, category_id, restaurant_id, name, description, price, display_order) VALUES
  -- Starters
  ('item-garlic-bread', 'cat-starters', 'rest-001', 'Garlic Bread',          'Toasted ciabatta with garlic butter',                    450, 1),
  ('item-wings',        'cat-starters', 'rest-001', 'Crispy Chicken Wings',  '6 wings with your choice of sauce',                      750, 2),
  ('item-soup',         'cat-starters', 'rest-001', 'Soup of the Day',       'Ask your server for today''s soup, served with bread',   600, 3),
  -- Burgers (all served in a toasted brioche bun with gem lettuce & tomato)
  ('item-beef-burger',    'cat-burgers', 'rest-001', 'Classic Beef Burger',   '6oz beef patty, brioche bun, pickles',                  1250, 1),
  ('item-chicken-burger', 'cat-burgers', 'rest-001', 'Crispy Chicken Burger', 'Southern-fried chicken breast, slaw, brioche bun',      1150, 2),
  ('item-plant-burger',   'cat-burgers', 'rest-001', 'Plant Burger',          'Moving Mountains patty, vegan bun, lettuce, tomato',    1050, 3),
  -- Mains
  ('item-fish-chips',  'cat-mains', 'rest-001', 'Fish & Chips',        'Beer-battered cod, chunky chips, mushy peas, tartare sauce',  1400, 1),
  ('item-steak',       'cat-mains', 'rest-001', '8oz Ribeye Steak',    'Dry-aged ribeye, chunky chips, watercress, peppercorn sauce', 2400, 2),
  ('item-pasta',       'cat-mains', 'rest-001', 'Penne Arrabbiata',    'San Marzano tomato, chilli, garlic, fresh basil',             1050, 3),
  ('item-caesar',      'cat-mains', 'rest-001', 'Caesar Salad',        'Cos lettuce, croutons, parmesan, caesar dressing',            950, 4),
  -- Sides
  ('item-chips',       'cat-sides', 'rest-001', 'Chunky Chips',        'Twice-cooked, sea salt',                                       350, 1),
  ('item-sweet-fries', 'cat-sides', 'rest-001', 'Sweet Potato Fries',  'Lightly seasoned',                                             400, 2),
  ('item-side-salad',  'cat-sides', 'rest-001', 'Side Salad',          'Mixed leaves, cherry tomato, cucumber, balsamic',              300, 3),
  ('item-onion-rings', 'cat-sides', 'rest-001', 'Onion Rings',         'Beer-battered, four rings',                                    400, 4),
  ('item-coleslaw',    'cat-sides', 'rest-001', 'Coleslaw',            'House-made with wholegrain mustard',                           300, 5),
  -- Desserts
  ('item-brownie',     'cat-desserts', 'rest-001', 'Chocolate Brownie', 'Warm chocolate brownie, vanilla ice cream',                   700, 1),
  ('item-cheesecake',  'cat-desserts', 'rest-001', 'Baked Cheesecake',  'Vanilla cheesecake, berry compote, biscuit base',             650, 2),
  ('item-ice-cream',   'cat-desserts', 'rest-001', 'Two Scoops',        'Ask for today''s flavours',                                    500, 3),
  -- Drinks
  ('item-coke',         'cat-drinks', 'rest-001', 'Coca-Cola',         '330ml can',   300, 1),
  ('item-diet-coke',    'cat-drinks', 'rest-001', 'Diet Coke',         '330ml can',   300, 2),
  ('item-lemonade',     'cat-drinks', 'rest-001', 'Lemonade',          '330ml can',   300, 3),
  ('item-oj',           'cat-drinks', 'rest-001', 'Orange Juice',      '250ml glass', 300, 4),
  ('item-still-water',  'cat-drinks', 'rest-001', 'Still Water',       '500ml bottle',200, 5),
  ('item-sparkling',    'cat-drinks', 'rest-001', 'Sparkling Water',   '500ml bottle',200, 6);

-- Allergens
INSERT OR IGNORE INTO menu_item_allergens (item_id, allergen) VALUES
  ('item-garlic-bread', 'gluten'), ('item-garlic-bread', 'milk'),
  ('item-soup',         'celery'), ('item-soup', 'gluten'), ('item-soup', 'milk'),
  ('item-beef-burger',    'gluten'), ('item-beef-burger',    'eggs'), ('item-beef-burger', 'milk'),
  ('item-chicken-burger', 'gluten'), ('item-chicken-burger', 'eggs'), ('item-chicken-burger', 'milk'),
  ('item-plant-burger',   'gluten'), ('item-plant-burger',   'soya'),
  ('item-fish-chips', 'gluten'), ('item-fish-chips', 'fish'), ('item-fish-chips', 'eggs'), ('item-fish-chips', 'milk'),
  ('item-pasta',      'gluten'),
  ('item-caesar',     'eggs'), ('item-caesar', 'fish'), ('item-caesar', 'milk'), ('item-caesar', 'gluten'),
  ('item-chips',       'gluten'),
  ('item-sweet-fries', 'gluten'),
  ('item-onion-rings', 'gluten'), ('item-onion-rings', 'eggs'), ('item-onion-rings', 'milk'),
  ('item-coleslaw',    'eggs'), ('item-coleslaw', 'mustard'), ('item-coleslaw', 'milk'),
  ('item-brownie',    'gluten'), ('item-brownie', 'eggs'), ('item-brownie', 'milk'), ('item-brownie', 'nuts'),
  ('item-cheesecake', 'gluten'), ('item-cheesecake', 'milk'), ('item-cheesecake', 'eggs'),
  ('item-ice-cream',  'milk'), ('item-ice-cream', 'eggs');

-- Option groups
INSERT OR IGNORE INTO option_groups (id, item_id, name, type, required, display_order) VALUES
  ('og-beef-sauce',      'item-beef-burger',    'Sauce',     'single', 1, 1),
  ('og-beef-extras',     'item-beef-burger',    'Add extras','multi',  0, 2),
  ('og-chicken-sauce',   'item-chicken-burger', 'Sauce',     'single', 1, 1),
  ('og-chicken-extras',  'item-chicken-burger', 'Add extras','multi',  0, 2),
  ('og-steak-doneness',  'item-steak',          'Doneness',  'single', 1, 1),
  ('og-caesar-addon',    'item-caesar',         'Add protein','multi', 0, 1),
  ('og-ice-cream-scoop', 'item-ice-cream',      'Flavours',  'multi',  1, 1);

-- Choices
INSERT OR IGNORE INTO option_choices (id, group_id, name, price_delta, in_stock) VALUES
  -- Beef burger sauce
  ('oc-beef-plain',       'og-beef-sauce',     'No sauce',        0, 1),
  ('oc-beef-ketchup',     'og-beef-sauce',     'Ketchup',         0, 1),
  ('oc-beef-mayo',        'og-beef-sauce',     'Mayo',            0, 1),
  ('oc-beef-burgersauce', 'og-beef-sauce',     'Burger sauce',    0, 1),
  -- Beef burger extras
  ('oc-beef-cheese',      'og-beef-extras',    'Cheese',        150, 1),
  ('oc-beef-bacon',       'og-beef-extras',    'Bacon',         150, 1),
  ('oc-beef-extrapatty',  'og-beef-extras',    'Extra patty',   350, 1),
  -- Chicken burger sauce
  ('oc-chk-plain',        'og-chicken-sauce',  'No sauce',        0, 1),
  ('oc-chk-ketchup',      'og-chicken-sauce',  'Ketchup',         0, 1),
  ('oc-chk-mayo',         'og-chicken-sauce',  'Mayo',            0, 1),
  ('oc-chk-sriracha',     'og-chicken-sauce',  'Sriracha mayo',   0, 1),
  -- Chicken burger extras
  ('oc-chk-cheese',       'og-chicken-extras', 'Cheese',        150, 1),
  ('oc-chk-bacon',        'og-chicken-extras', 'Bacon',         150, 1),
  -- Steak doneness
  ('oc-steak-blue',       'og-steak-doneness', 'Blue rare',       0, 1),
  ('oc-steak-rare',       'og-steak-doneness', 'Rare',            0, 1),
  ('oc-steak-med-rare',   'og-steak-doneness', 'Medium rare',     0, 1),
  ('oc-steak-medium',     'og-steak-doneness', 'Medium',          0, 1),
  ('oc-steak-well',       'og-steak-doneness', 'Well done',       0, 1),
  -- Caesar add-ons
  ('oc-caesar-chicken',   'og-caesar-addon',   'Grilled chicken',350, 1),
  ('oc-caesar-halloumi',  'og-caesar-addon',   'Halloumi',       350, 1),
  ('oc-caesar-anchovies', 'og-caesar-addon',   'Anchovies',        0, 1),
  -- Ice cream flavours
  ('oc-ice-vanilla',      'og-ice-cream-scoop','Vanilla',          0, 1),
  ('oc-ice-chocolate',    'og-ice-cream-scoop','Chocolate',        0, 1),
  ('oc-ice-strawberry',   'og-ice-cream-scoop','Strawberry',       0, 1),
  ('oc-ice-salted',       'og-ice-cream-scoop','Salted caramel',   0, 1);

-- Allergens on choices (only ones that add new allergens beyond the item base)
INSERT OR IGNORE INTO option_choice_allergens (choice_id, allergen) VALUES
  -- Mayo adds eggs (beef burger)
  ('oc-beef-mayo',      'eggs'),
  -- Burger sauce adds eggs + mustard
  ('oc-beef-burgersauce','eggs'), ('oc-beef-burgersauce','mustard'),
  -- Cheese adds milk
  ('oc-beef-cheese',    'milk'), ('oc-chk-cheese', 'milk'),
  -- Sriracha mayo adds eggs
  ('oc-chk-sriracha',   'eggs'),
  -- Caesar halloumi adds milk (already on base but explicit)
  ('oc-caesar-halloumi','milk'),
  -- Caesar anchovies adds fish (already on base but explicit)
  ('oc-caesar-anchovies','fish');
