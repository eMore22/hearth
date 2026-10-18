-- Personal documents are private by default; the uploader can opt in to
-- household visibility. Supabase service-role writes still use API checks.
-- Existing records become private. Do not publish IDs/medical documents by default.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS visibility text;
UPDATE public.documents SET visibility='private' WHERE visibility IS NULL;
ALTER TABLE public.documents ALTER COLUMN visibility SET DEFAULT 'private';
ALTER TABLE public.documents ALTER COLUMN visibility SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.documents'::regclass
                   AND conname='documents_visibility_value_check') THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_visibility_value_check
      CHECK (visibility IN ('private','household'));
  END IF;
END $$;

DROP POLICY IF EXISTS household_access ON public.documents;
DROP POLICY IF EXISTS documents_read_authorized ON public.documents;
CREATE POLICY documents_read_authorized ON public.documents FOR SELECT TO authenticated
USING (household_id = public.get_my_household_id()
       AND (uploaded_by = auth.uid() OR visibility = 'household'));

-- Authenticated clients must not write/delete files or document rows directly.
-- Backend access remains verified and uses service-role.
DROP POLICY IF EXISTS household_access ON public.document_alerts;
DROP POLICY IF EXISTS document_alerts_read_authorized ON public.document_alerts;
CREATE POLICY document_alerts_read_authorized ON public.document_alerts FOR SELECT TO authenticated
USING (household_id = public.get_my_household_id() AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_alerts.document_id
      AND d.household_id = document_alerts.household_id
      AND (d.uploaded_by=auth.uid() OR d.visibility='household')
));

-- Storage bucket must remain private, including for public-style legacy URLs.
UPDATE storage.buckets SET public = false WHERE id='documents';
