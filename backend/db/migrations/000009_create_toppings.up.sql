CREATE TABLE toppings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    unit_price INT NOT NULL CHECK (unit_price >= 0),
    sold_out BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT toppings_id_store_id_unique UNIQUE (id, store_id)
);

CREATE INDEX toppings_active_store_id_idx
    ON toppings (store_id)
    WHERE deleted_at IS NULL;

ALTER TABLE menus
    ADD CONSTRAINT menus_id_store_id_unique UNIQUE (id, store_id);

CREATE TABLE menu_toppings (
    menu_id UUID NOT NULL,
    topping_id UUID NOT NULL,
    store_id UUID NOT NULL,

    PRIMARY KEY (menu_id, topping_id),
    FOREIGN KEY (menu_id, store_id)
        REFERENCES menus(id, store_id)
        ON DELETE CASCADE,
    FOREIGN KEY (topping_id, store_id)
        REFERENCES toppings(id, store_id)
        ON DELETE CASCADE
);
