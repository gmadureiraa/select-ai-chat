ALTER TABLE public.viral_carousels
  ADD COLUMN IF NOT EXISTS planning_item_id uuid REFERENCES public.planning_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_viral_carousels_planning_item ON public.viral_carousels(planning_item_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'viral_carousels_source_check'
  ) THEN
    ALTER TABLE public.viral_carousels
      ADD CONSTRAINT viral_carousels_source_check
      CHECK (source IN ('manual', 'automation', 'chat'));
  END IF;
END $$;