ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_member boolean NOT NULL DEFAULT true;
UPDATE public.players SET is_member = false WHERE is_guest = true OR is_active = false;