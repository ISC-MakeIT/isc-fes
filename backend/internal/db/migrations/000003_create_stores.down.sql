DROP INDEX IF EXISTS accounts_store_id_idx;

ALTER TABLE accounts
DROP COLUMN IF EXISTS store_id;

DROP TABLE stores;
DROP TYPE store_review_status;
