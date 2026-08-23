ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS birth_year integer,
  ADD COLUMN IF NOT EXISTS pref_positions text,
  ADD COLUMN IF NOT EXISTS sub_positions text,
  ADD COLUMN IF NOT EXISTS note text;