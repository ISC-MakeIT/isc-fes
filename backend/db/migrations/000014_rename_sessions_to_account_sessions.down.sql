BEGIN;

ALTER INDEX account_sessions_expiry_idx
    RENAME TO sessions_expiry_idx;

ALTER TABLE account_sessions
    RENAME CONSTRAINT account_sessions_pkey TO sessions_pkey;

ALTER TABLE account_sessions
    RENAME TO sessions;

COMMIT;