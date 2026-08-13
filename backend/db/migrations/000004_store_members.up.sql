BEGIN;

CREATE TYPE store_member_role as ENUM ('manager', 'member'); -- 店舗メンバーの役割。manager は店舗メンバー申請の承認権限や、メニュー変更権限を持つ。

CREATE TABLE store_members (
    store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    role store_member_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (store_id, account_id)
);

-- 現在のstore_idは店舗作成時に設定されたものなので、
-- manager として移行する
INSERT INTO store_members (
    store_id,
    account_id,
    role,
    joined_at
)
SELECT
    accounts.store_id,
    accounts.id,
    'manager',
    stores.created_at
FROM accounts
JOIN stores
    ON stores.id = accounts.store_id
WHERE accounts.store_id IS NOT NULL;

DROP INDEX accounts_store_id_idx;

ALTER TABLE accounts
DROP COLUMN store_id;

COMMIT;