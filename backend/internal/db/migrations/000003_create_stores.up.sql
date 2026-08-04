CREATE TYPE store_review_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);

CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,

    -- 教室番号 --
    room VARCHAR(50) NOT NULL,
    description VARCHAR(1000) NOT NULL,

    -- S3のURLではなくオブジェクトキー
    image_object_key TEXT NOT NULL,

    review_status store_review_status NOT NULL DEFAULT 'pending',

    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX stores_review_status_idx
    ON stores(review_status, submitted_at);

ALTER TABLE accounts
ADD COLUMN store_id UUID
    REFERENCES stores(id);

CREATE INDEX accounts_store_id_idx
    ON accounts(store_id);