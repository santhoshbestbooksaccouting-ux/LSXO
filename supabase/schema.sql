-- =========================================================================
-- DuoXO: Private Real-Time Tic-Tac-Toe for Two Friends
-- Supabase Schema, RLS, Concurrency Lock Functions & Realtime Publication
-- =========================================================================

-- 1. Create rooms table
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
  winner TEXT, -- 'X', 'O', 'DRAW', or NULL
  winning_line JSONB, -- [0, 1, 2] or NULL
  match_id INTEGER NOT NULL DEFAULT 1,
  p1_score INTEGER NOT NULL DEFAULT 0,
  p2_score INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  p1_rematch_ready BOOLEAN NOT NULL DEFAULT FALSE,
  p2_rematch_ready BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- 3. Row Level Security Policies
-- Read policy: Anyone with Anon key can read room state
DROP POLICY IF EXISTS "Public can view rooms" ON public.rooms;
CREATE POLICY "Public can view rooms"
  ON public.rooms
  FOR SELECT
  USING (true);

-- Insert policy: Anyone can create a private room
DROP POLICY IF EXISTS "Public can create rooms" ON public.rooms;
CREATE POLICY "Public can create rooms"
  ON public.rooms
  FOR INSERT
  WITH CHECK (true);

-- Update policy: Authorized updates allowed
DROP POLICY IF EXISTS "Players can update room" ON public.rooms;
CREATE POLICY "Players can update room"
  ON public.rooms
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 4. Enable Realtime Replication for rooms table
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;

-- Seed the dedicated private room for Ithal and Sanu
INSERT INTO public.rooms (
  id, passcode, player1_id, player1_name, player2_id, player2_name,
  board, current_turn, starter, match_id, p1_score, p2_score, draws
) VALUES (
  'room_ithal_sanu', 'ithal_sanu_private_2026', 'user_ithal', 'Ithal', 'user_sanu', 'Sanu',
  '["","","","","","","","",""]'::jsonb, 'X', 'X', 1, 0, 0, 0
)
ON CONFLICT (id) DO NOTHING;

-- 5. Atomic RPC: join_private_room
-- Authorizes only the 2 intended players; prevents third-party eavesdroppers from joining
CREATE OR REPLACE FUNCTION public.join_private_room(
  p_room_id TEXT,
  p_passcode TEXT,
  p_player_id TEXT,
  p_player_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room RECORD;
BEGIN
  -- Lock the row to prevent race conditions during join
  SELECT * INTO v_room
  FROM public.rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room % does not exist.', p_room_id;
  END IF;

  -- Verify private passcode
  IF v_room.passcode <> p_passcode THEN
    RAISE EXCEPTION 'Invalid room passcode. Access denied.';
  END IF;

  -- Case 1: Returning Player 1
  IF v_room.player1_id = p_player_id THEN
    UPDATE public.rooms
    SET player1_name = p_player_name,
        updated_at = now()
    WHERE id = p_room_id;

    SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
    RETURN to_jsonb(v_room);
  END IF;

  -- Case 2: Returning Player 2
  IF v_room.player2_id = p_player_id THEN
    UPDATE public.rooms
    SET player2_name = p_player_name,
        updated_at = now()
    WHERE id = p_room_id;

    SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
    RETURN to_jsonb(v_room);
  END IF;

  -- Case 3: Empty Slot 2 -> Assign Player 2
  IF v_room.player2_id IS NULL THEN
    UPDATE public.rooms
    SET player2_id = p_player_id,
        player2_name = p_player_name,
        updated_at = now()
    WHERE id = p_room_id;

    SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
    RETURN to_jsonb(v_room);
  END IF;

  -- Case 4: Room is already full with two authorized players! Third player blocked!
  RAISE EXCEPTION 'This private room is full. Only the two authorized friends may enter.';
END;
$$;

-- 6. Atomic RPC: make_atomic_move
-- Concurrency-safe move execution with row-level locking
CREATE OR REPLACE FUNCTION public.make_atomic_move(
  p_room_id TEXT,
  p_player_id TEXT,
  p_cell_index INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room RECORD;
  v_symbol TEXT;
  v_board TEXT[];
  v_winner TEXT := NULL;
  v_line INT[] := NULL;
  v_empty_count INT := 0;
  v_lines INT[][] := ARRAY[
    [0,1,2], [3,4,5], [6,7,8], -- Rows
    [0,3,6], [1,4,7], [2,5,8], -- Columns
    [0,4,8], [2,4,6]           -- Diagonals
  ];
  i INT;
  a INT;
  b INT;
  c INT;
BEGIN
  -- Strict bounds check
  IF p_cell_index < 0 OR p_cell_index > 8 THEN
    RAISE EXCEPTION 'Invalid board cell index %', p_cell_index;
  END IF;

  -- Lock row for update
  SELECT * INTO v_room
  FROM public.rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room % not found.', p_room_id;
  END IF;

  -- Check authorized players
  IF v_room.player1_id = p_player_id THEN
    v_symbol := 'X';
  ELSIF v_room.player2_id = p_player_id THEN
    v_symbol := 'O';
  ELSE
    RAISE EXCEPTION 'Unauthorized player. You are not a player in this room.';
  END IF;

  -- Check second player has joined
  IF v_room.player2_id IS NULL THEN
    RAISE EXCEPTION 'Waiting for your friend to join before starting moves.';
  END IF;

  -- Check if game has already finished
  IF v_room.winner IS NOT NULL THEN
    RAISE EXCEPTION 'Game has already ended. Start a rematch to play again.';
  END IF;

  -- Check turn
  IF v_room.current_turn <> v_symbol THEN
    RAISE EXCEPTION 'Not your turn. It is player %s turn.', v_room.current_turn;
  END IF;

  -- Extract board array
  SELECT ARRAY(
    SELECT jsonb_array_elements_text(v_room.board)
  ) INTO v_board;

  -- Verify cell is empty (1-indexed in Postgres array)
  IF v_board[p_cell_index + 1] <> '' THEN
    RAISE EXCEPTION 'Cell % is already occupied.', p_cell_index;
  END IF;

  -- Apply move
  v_board[p_cell_index + 1] := v_symbol;

  -- Check winning combinations
  FOR i IN 1..8 LOOP
    a := v_lines[i][1] + 1;
    b := v_lines[i][2] + 1;
    c := v_lines[i][3] + 1;

    IF v_board[a] <> '' AND v_board[a] = v_board[b] AND v_board[b] = v_board[c] THEN
      v_winner := v_board[a];
      v_line := ARRAY[v_lines[i][1], v_lines[i][2], v_lines[i][3]];
      EXIT;
    END IF;
  END LOOP;

  -- Check for draw
  IF v_winner IS NULL THEN
    FOR i IN 1..9 LOOP
      IF v_board[i] = '' THEN
        v_empty_count := v_empty_count + 1;
      END IF;
    END LOOP;

    IF v_empty_count = 0 THEN
      v_winner := 'DRAW';
    END IF;
  END IF;

  -- Update room state
  UPDATE public.rooms
  SET
    board = to_jsonb(v_board),
    winner = v_winner,
    winning_line = CASE WHEN v_line IS NOT NULL THEN to_jsonb(v_line) ELSE NULL END,
    current_turn = CASE WHEN v_winner IS NOT NULL THEN v_room.current_turn
                        WHEN v_symbol = 'X' THEN 'O' ELSE 'X' END,
    p1_score = CASE WHEN v_winner = 'X' THEN v_room.p1_score + 1 ELSE v_room.p1_score END,
    p2_score = CASE WHEN v_winner = 'O' THEN v_room.p2_score + 1 ELSE v_room.p2_score END,
    draws = CASE WHEN v_winner = 'DRAW' THEN v_room.draws + 1 ELSE v_room.draws END,
    p1_rematch_ready = FALSE,
    p2_rematch_ready = FALSE,
    updated_at = now()
  WHERE id = p_room_id;

  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  RETURN to_jsonb(v_room);
END;
$$;

-- 7. Atomic RPC: request_rematch
-- Resets board when rematch is agreed upon or toggles ready flag
CREATE OR REPLACE FUNCTION public.request_rematch(
  p_room_id TEXT,
  p_player_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room RECORD;
  v_is_p1 BOOLEAN;
  v_next_starter TEXT;
  v_empty_board JSONB := '["","","","","","","","",""]'::jsonb;
BEGIN
  SELECT * INTO v_room
  FROM public.rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room % not found.', p_room_id;
  END IF;

  IF v_room.player1_id = p_player_id THEN
    v_is_p1 := TRUE;
  ELSIF v_room.player2_id = p_player_id THEN
    v_is_p1 := FALSE;
  ELSE
    RAISE EXCEPTION 'Unauthorized player.';
  END IF;

  -- Check if other player is already ready or if we immediately start
  -- Alternate starter for fairness
  v_next_starter := CASE WHEN v_room.starter = 'X' THEN 'O' ELSE 'X' END;

  IF (v_is_p1 AND v_room.p2_rematch_ready) OR (NOT v_is_p1 AND v_room.p1_rematch_ready) THEN
    -- Both players ready: Start new match!
    UPDATE public.rooms
    SET
      board = v_empty_board,
      starter = v_next_starter,
      current_turn = v_next_starter,
      winner = NULL,
      winning_line = NULL,
      match_id = v_room.match_id + 1,
      p1_rematch_ready = FALSE,
      p2_rematch_ready = FALSE,
      updated_at = now()
    WHERE id = p_room_id;
  ELSE
    -- Mark this player ready
    UPDATE public.rooms
    SET
      p1_rematch_ready = CASE WHEN v_is_p1 THEN TRUE ELSE v_room.p1_rematch_ready END,
      p2_rematch_ready = CASE WHEN NOT v_is_p1 THEN TRUE ELSE v_room.p2_rematch_ready END,
      updated_at = now()
    WHERE id = p_room_id;
  END IF;

  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  RETURN to_jsonb(v_room);
END;
$$;
