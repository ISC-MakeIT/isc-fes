BEGIN;

CREATE TYPE order_status AS ENUM ('pending', 'ready', 'completed', 'cancelled');

ALTER TABLE carts
    ADD CONSTRAINT carts_id_guest_id_store_id_unique UNIQUE (id, guest_id, store_id);

CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
    status order_status NOT NULL DEFAULT 'pending',
    total_amount bigint NOT NULL CHECK (total_amount >= 0),
    display_number integer NOT NULL CHECK (display_number > 0),
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    origin_cart_id uuid NOT NULL,
    origin_cart_version integer NOT NULL CHECK (origin_cart_version > 0),
    limit_exempted_by_account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT,
    store_name text NOT NULL,
    room_name text NOT NULL,
    ready_at timestamptz,
    completed_at timestamptz,
    cancelled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT orders_id_store_id_unique UNIQUE (id, store_id),
    CONSTRAINT orders_store_id_display_number_unique UNIQUE (store_id, display_number),
    CONSTRAINT orders_origin_cart_id_version_unique UNIQUE (origin_cart_id, origin_cart_version),
    CONSTRAINT orders_origin_cart_fkey FOREIGN KEY (origin_cart_id, guest_id, store_id)
        REFERENCES carts(id, guest_id, store_id) ON DELETE RESTRICT,
    CONSTRAINT orders_status_timestamps_check CHECK (
        (status = 'pending' AND ready_at IS NULL AND completed_at IS NULL AND cancelled_at IS NULL)
        OR (status = 'ready' AND ready_at IS NOT NULL AND completed_at IS NULL AND cancelled_at IS NULL)
        OR (status = 'completed' AND ready_at IS NOT NULL AND completed_at IS NOT NULL AND cancelled_at IS NULL)
        OR (status = 'cancelled' AND ready_at IS NOT NULL AND completed_at IS NULL AND cancelled_at IS NOT NULL)
    ),
    CONSTRAINT orders_timestamp_order_check CHECK (
        updated_at >= created_at
        AND (ready_at IS NULL OR ready_at BETWEEN created_at AND updated_at)
        AND (completed_at IS NULL OR completed_at BETWEEN ready_at AND updated_at)
        AND (cancelled_at IS NULL OR cancelled_at BETWEEN ready_at AND updated_at)
    )
);

CREATE INDEX orders_guest_history_idx ON orders (guest_id, created_at DESC, id DESC);
CREATE INDEX orders_store_list_idx ON orders (store_id, created_at, id);
CREATE INDEX orders_guest_active_non_exempt_idx ON orders (guest_id)
    WHERE status IN ('pending', 'ready') AND limit_exempted_by_account_id IS NULL;

CREATE TABLE order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    store_id uuid NOT NULL,
    menu_id uuid NOT NULL,
    menu_name text NOT NULL,
    unit_price integer NOT NULL CHECK (unit_price >= 0),
    quantity integer NOT NULL CHECK (quantity > 0),

    CONSTRAINT order_items_id_store_id_unique UNIQUE (id, store_id),
    CONSTRAINT order_items_order_fkey FOREIGN KEY (order_id, store_id)
        REFERENCES orders(id, store_id) ON DELETE RESTRICT,
    CONSTRAINT order_items_menu_fkey FOREIGN KEY (menu_id, store_id)
        REFERENCES menus(id, store_id) ON DELETE RESTRICT
);

CREATE INDEX order_items_order_id_idx ON order_items (order_id);

CREATE TABLE order_item_toppings (
    order_item_id uuid NOT NULL,
    store_id uuid NOT NULL,
    topping_id uuid NOT NULL,
    topping_name text NOT NULL,
    unit_price integer NOT NULL CHECK (unit_price >= 0),

    PRIMARY KEY (order_item_id, topping_id),
    CONSTRAINT order_item_toppings_item_fkey FOREIGN KEY (order_item_id, store_id)
        REFERENCES order_items(id, store_id) ON DELETE RESTRICT,
    CONSTRAINT order_item_toppings_topping_fkey FOREIGN KEY (topping_id, store_id)
        REFERENCES toppings(id, store_id) ON DELETE RESTRICT
);

-- トッピングのPKはorder_item_idからの一括取得の索引も兼ねる。
-- menu_toppingsは参照しない。関連解除後も注文時の選択を保持する。
CREATE TABLE store_order_counters (
    store_id uuid PRIMARY KEY REFERENCES stores(id) ON DELETE RESTRICT,
    last_number integer NOT NULL CHECK (last_number > 0)
);

COMMIT;
