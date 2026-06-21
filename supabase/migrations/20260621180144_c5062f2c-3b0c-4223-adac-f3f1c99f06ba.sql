ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

UPDATE public.matches m SET is_internal = true
WHERE m.id IN (
  SELECT t.match_id FROM public.teams t
  GROUP BY t.match_id HAVING count(*) >= 2 AND bool_and(t.is_ours) = true
);