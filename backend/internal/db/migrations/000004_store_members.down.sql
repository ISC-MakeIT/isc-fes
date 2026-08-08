BEGIN;

LOCK TABLE store_members IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (
        SELECT account_id
        FROM store_members
        GROUP BY account_id
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION
            'cannot rollback: accounts with multiple store memberships exist';
    END IF;
END
$$;

ALTER TABLE accounts
ADD COLUMN store_id UUID
    REFERENCES stores(id);

UPDATE accounts
SET store_id = store_members.store_id
FROM store_members
WHERE store_members.account_id = accounts.id;

CREATE INDEX accounts_store_id_idx
    ON accounts(store_id);

DROP TABLE store_members;

DROP TYPE store_member_role;

COMMIT;
