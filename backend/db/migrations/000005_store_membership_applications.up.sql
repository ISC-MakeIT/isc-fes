CREATE TYPE store_membership_application_status AS ENUM ('pending', 'approved', 'rejected');


CREATE TABLE store_membership_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    store_id UUID NOT NULL
        REFERENCES stores(id),
    account_id UUID NOT NULL
        REFERENCES accounts(id),

    status store_membership_application_status
        NOT NULL DEFAULT 'pending',

    reviewed_by UUID
        REFERENCES accounts(id),

    rejection_reason TEXT,

    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX store_membership_applications_one_pending_idx
ON store_membership_applications (
    store_id,
    account_id
)
WHERE status = 'pending';