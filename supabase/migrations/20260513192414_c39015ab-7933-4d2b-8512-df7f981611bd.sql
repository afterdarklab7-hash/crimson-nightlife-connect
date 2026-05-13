
-- Realtime publication + replica identity
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_bookings REPLICA IDENTITY FULL;
ALTER TABLE public.photos REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.matches; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.room_bookings; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.photos; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Ensure single primary photo per user
CREATE OR REPLACE FUNCTION public.enforce_single_primary_photo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.photos SET is_primary = false
      WHERE user_id = NEW.user_id AND id <> NEW.id AND is_primary = true;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_single_primary_photo() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_single_primary_photo ON public.photos;
CREATE TRIGGER trg_single_primary_photo
AFTER INSERT OR UPDATE OF is_primary ON public.photos
FOR EACH ROW WHEN (NEW.is_primary = true)
EXECUTE FUNCTION public.enforce_single_primary_photo();

-- Clean existing duplicates: keep newest as primary
WITH ranked AS (
  SELECT id, user_id, is_primary,
    ROW_NUMBER() OVER (PARTITION BY user_id, is_primary ORDER BY created_at DESC) AS rn
  FROM public.photos WHERE is_primary = true
)
UPDATE public.photos p SET is_primary = false
FROM ranked r WHERE p.id = r.id AND r.rn > 1;
