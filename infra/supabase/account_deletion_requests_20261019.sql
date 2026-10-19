-- Account deletion request tracking; this does NOT delete any account.
-- Authenticated users can read only their own request status. Writes are
-- reserved to our authenticated backend using Supabase service-role.
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    household_id_at_request uuid,
    status text NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested','processing','completed','cancelled','rejected')),
    requested_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_one_active_per_user
    ON public.account_deletion_requests (user_id)
    WHERE status IN ('requested','processing');

CREATE INDEX IF NOT EXISTS account_deletion_requests_status_time
    ON public.account_deletion_requests (status,requested_at);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_deletion_owner_read ON public.account_deletion_requests;
CREATE POLICY account_deletion_owner_read ON public.account_deletion_requests
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Do not add INSERT, UPDATE, DELETE policies for authenticated users.
-- The server verifies bearer auth and uses the service role.
REVOKE INSERT, UPDATE, DELETE ON public.account_deletion_requests FROM anon, authenticated;
