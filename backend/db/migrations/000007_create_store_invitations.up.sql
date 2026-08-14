CREATE TABLE store_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    role store_member_role NOT NULL DEFAULT 'member',
    max_uses INT DEFAULT 1
        CHECK (max_uses IS NULL OR max_uses > 0),

    use_count INT NOT NULL DEFAULT 0
        CHECK (use_count >= 0),

    CHECK (
        max_uses IS NULL
        OR use_count <= max_uses
    ),
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
