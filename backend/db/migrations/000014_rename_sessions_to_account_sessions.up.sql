BEGIN;

ALTER TABLE sessions
    RENAME TO account_sessions;

ALTER TABLE account_sessions
    RENAME CONSTRAINT sessions_pkey TO account_sessions_pkey;

ALTER INDEX sessions_expiry_idx
    RENAME TO account_sessions_expiry_idx;

COMMIT;