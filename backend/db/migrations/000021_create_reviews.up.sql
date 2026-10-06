-- アプリの利用体験に対するレビュー。店舗の商品に対するレビューではない。
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment VARCHAR(1000),
    -- 表示のきっかけ。例: order_complete, menu_update...
    trigger VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 投稿者を削除してもレビューを分析用に残す。
CREATE INDEX reviews_trigger_created_at_idx ON reviews (trigger, created_at);
CREATE INDEX reviews_guest_id_created_at_idx ON reviews (guest_id, created_at) WHERE guest_id IS NOT NULL;
CREATE INDEX reviews_account_id_created_at_idx ON reviews (account_id, created_at) WHERE account_id IS NOT NULL;
