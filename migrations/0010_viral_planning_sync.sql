-- 0010_viral_planning_sync.sql
-- Sync trigger: planning_items.status -> published cascades to viral_carousels / viral_reels
-- Plus indexes for reverse lookup from planning_items metadata.viral_reel_id.

CREATE OR REPLACE FUNCTION public.sync_publish_to_viral()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
    -- Sync linked viral_carousels (FK lives on viral_carousels.planning_item_id)
    UPDATE public.viral_carousels
    SET status = 'published',
        published_at = COALESCE(NEW.published_at, now())
    WHERE planning_item_id = NEW.id;

    -- Sync linked viral_reels (link lives in planning_items.metadata.viral_reel_id)
    IF NEW.metadata ? 'viral_reel_id' THEN
      UPDATE public.viral_reels
      SET status = 'published',
          updated_at = now()
      WHERE id = (NEW.metadata->>'viral_reel_id')::uuid;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS planning_item_publish_sync ON public.planning_items;
CREATE TRIGGER planning_item_publish_sync
AFTER UPDATE OF status ON public.planning_items
FOR EACH ROW EXECUTE FUNCTION public.sync_publish_to_viral();

-- Reverse-lookup indexes
CREATE INDEX IF NOT EXISTS idx_viral_carousels_planning
  ON public.viral_carousels(planning_item_id);

CREATE INDEX IF NOT EXISTS idx_planning_metadata_viral_reel
  ON public.planning_items USING GIN ((metadata -> 'viral_reel_id'));
