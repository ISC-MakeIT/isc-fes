CREATE TABLE carts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

    CONSTRAINT carts_guest_id_store_id_unique UNIQUE (guest_id, store_id),
    CONSTRAINT carts_id_store_id_unique UNIQUE (id, store_id)
);

CREATE TABLE cart_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id uuid NOT NULL,
    menu_id uuid NOT NULL,
    store_id uuid NOT NULL,
    quantity int NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT cart_items_id_menu_id_unique UNIQUE (id, menu_id),
    FOREIGN KEY (cart_id, store_id)
        REFERENCES carts(id, store_id)
        ON DELETE CASCADE,
    FOREIGN KEY (menu_id, store_id)
        REFERENCES menus(id, store_id)
        ON DELETE CASCADE
);

CREATE INDEX cart_items_cart_id_store_id_idx
    ON cart_items (cart_id, store_id);

CREATE TABLE cart_item_toppings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_item_id uuid NOT NULL,
    menu_id uuid NOT NULL,
    topping_id uuid NOT NULL,

    CONSTRAINT cart_item_toppings_cart_item_id_topping_id_unique
        UNIQUE (cart_item_id, topping_id),
    FOREIGN KEY (cart_item_id, menu_id)
        REFERENCES cart_items(id, menu_id)
        ON DELETE CASCADE,
    FOREIGN KEY (menu_id, topping_id)
        REFERENCES menu_toppings(menu_id, topping_id)
        ON DELETE CASCADE
);
