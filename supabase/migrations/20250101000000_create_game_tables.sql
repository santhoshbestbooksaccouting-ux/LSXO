-- Migration: 20250101000000_create_game_tables.sql
-- Private 2-Player XO Game Table, RLS & Concurrency Functions

CREATE TABLE IF NOT EXISTS public.rooms (
  id TEXT PRIMARY KEY,
  passcode TEXT NOT NULL,
  player1_id TEXT NOT NULL,
  player1_name TEXT NOT NULL,
  player2_id TEXT,
  player2_name TEXT,
  board JSONB NOT NULL DEFAULT '["","","","","","","","",""]'::jsonb,
  current_turn TEXT NOT NULL DEFAULT 'X',
  starter TEXT NOT NULL DEFAULT 'X',
  winner TEXT,
  winning_line JSONB,
  match_id INTEGER NOT NULL DEFAULT 1,
  p1_score INTEGER NOT NULL DEFAULT 0,
  p2_score INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  p1_rematch_ready BOOLEAN NOT NULL DEFAULT FALSE,
  p2_rematch_ready BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view rooms" ON public.rooms;
CREATE POLICY "Public can view rooms" ON public.rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can create rooms" ON public.rooms;
CREATE POLICY "Public can create rooms" ON public.rooms FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Players can update room" ON public.rooms;
CREATE POLICY "Players can update room" ON public.rooms FOR UPDATE USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;
END $$;

INSERT INTO public.rooms (
  id, passcode, player1_id, player1_name, player2_id, player2_name,
  board, current_turn, starter, match_id, p1_score, p2_score, draws
) VALUES (
  'room_ithal_sanu', 'ithal_sanu_private_2026', 'user_ithal', 'Ithal', 'user_sanu', 'Sanu',
  '["","","","","","","","",""]'::jsonb, 'X', 'X', 1, 0, 0, 0
)
ON CONFLICT (id) DO NOTHING;
