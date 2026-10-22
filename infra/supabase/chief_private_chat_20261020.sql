-- Chief conversations are private per signed-in user, even within a household.
-- Existing records are preserved and remain bound to their existing user_id.
-- The backend service-role performs writes after verified authentication.
-- Authenticated direct clients may only SELECT their own rows.
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS household_access ON public.chat_messages;
DROP POLICY IF EXISTS members_read_chat_messages ON public.chat_messages;
DROP POLICY IF EXISTS chat_owner_select ON public.chat_messages;
CREATE POLICY chat_owner_select ON public.chat_messages
FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.household_members hm
        WHERE hm.user_id = auth.uid()
          AND hm.household_id = chat_messages.household_id
    )
);
-- No authenticated INSERT/UPDATE/DELETE policy: all mutations go through
-- authorized backend routes, which independently check the caller's ID.
