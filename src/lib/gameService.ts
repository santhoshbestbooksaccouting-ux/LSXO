import { SupabaseClient } from '@supabase/supabase-js';
import { AuthenticatedAccount, PlayerSlot, PlayerSymbol, RoomRecord } from '../types/game';
import { checkWinner } from './gameLogic';

export interface JoinRoomResult {
  success: boolean;
  room?: RoomRecord;
  slot?: PlayerSlot;
  error?: string;
}

export interface MoveResult {
  success: boolean;
  room?: RoomRecord;
  error?: string;
}

/**
 * Initializes or enters the private room for Ithal & Sanu
 */
export async function getOrCreateDedicatedIthalSanuRoom(
  supabase: SupabaseClient,
  account: AuthenticatedAccount
): Promise<JoinRoomResult> {
  const roomId = 'room_ithal_sanu';
  const passcode = 'ithal_sanu_private_2026';

  // 1. Check if room exists
  const { data: existing } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();

  if (existing) {
    const slot: PlayerSlot = account.id === existing.player1_id ? 'p1' : 'p2';
    return { success: true, room: existing as RoomRecord, slot };
  }

  // 2. Insert shared room
  const initialRoom: Omit<RoomRecord, 'created_at' | 'updated_at'> = {
    id: roomId,
    passcode,
    player1_id: 'user_ithal',
    player1_name: 'Ithal',
    player2_id: 'user_sanu',
    player2_name: 'Sanu',
    board: ['', '', '', '', '', '', '', '', ''],
    current_turn: 'X',
    starter: 'X',
    winner: null,
    winning_line: null,
    match_id: 1,
    p1_score: 0,
    p2_score: 0,
    draws: 0,
    p1_rematch_ready: false,
    p2_rematch_ready: false,
  };

  const { data: created, error: insertError } = await supabase
    .from('rooms')
    .upsert([initialRoom], { onConflict: 'id' })
    .select()
    .single();

  if (insertError || !created) {
    return {
      success: false,
      error: insertError?.message || 'Failed to initialize shared room for Ithal and Sanu.',
    };
  }

  const slot: PlayerSlot = account.id === created.player1_id ? 'p1' : 'p2';
  return { success: true, room: created as RoomRecord, slot };
}

/**
 * Creates a brand new private room in Supabase
 */
export async function createPrivateRoom(
  supabase: SupabaseClient,
  roomId: string,
  passcode: string,
  playerId: string,
  playerName: string
): Promise<JoinRoomResult> {
  const initialRoom: Omit<RoomRecord, 'created_at' | 'updated_at'> = {
    id: roomId,
    passcode: passcode.trim(),
    player1_id: playerId,
    player1_name: playerName.trim() || 'Player 1',
    player2_id: null,
    player2_name: null,
    board: ['', '', '', '', '', '', '', '', ''],
    current_turn: 'X',
    starter: 'X',
    winner: null,
    winning_line: null,
    match_id: 1,
    p1_score: 0,
    p2_score: 0,
    draws: 0,
    p1_rematch_ready: false,
    p2_rematch_ready: false,
  };

  const { data, error } = await supabase
    .from('rooms')
    .insert([initialRoom])
    .select()
    .single();

  if (error) {
    console.error('Error creating room in Supabase:', error);
    return { success: false, error: error.message };
  }

  return { success: true, room: data as RoomRecord, slot: 'p1' };
}

/**
 * Joins an existing private room.
 * Enforces passcode and restricts room to strictly 2 authorized friends.
 */
export async function joinPrivateRoom(
  supabase: SupabaseClient,
  roomId: string,
  passcode: string,
  playerId: string,
  playerName: string
): Promise<JoinRoomResult> {
  // 1. First attempt atomic RPC if database schema was created with RPC
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'join_private_room',
      {
        p_room_id: roomId,
        p_passcode: passcode.trim(),
        p_player_id: playerId,
        p_player_name: playerName.trim() || 'Player',
      }
    );

    if (!rpcError && rpcData) {
      const room = rpcData as RoomRecord;
      const slot: PlayerSlot = room.player1_id === playerId ? 'p1' : 'p2';
      return { success: true, room, slot };
    }

    // If RPC doesn't exist yet, we fall through to direct queries
    if (rpcError && rpcError.message && !rpcError.message.includes('function') && !rpcError.message.includes('not found')) {
      return { success: false, error: rpcError.message };
    }
  } catch {
    // Continue to fallback
  }

  // 2. Direct Query Fallback
  const { data: room, error: fetchError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (fetchError || !room) {
    return {
      success: false,
      error: `Room "${roomId}" not found. Verify the ID or create a new room.`,
    };
  }

  // Check passcode
  if (room.passcode !== passcode.trim()) {
    return { success: false, error: 'Incorrect private room passcode.' };
  }

  // Case A: Player 1 reconnecting
  if (room.player1_id === playerId) {
    if (playerName && playerName !== room.player1_name) {
      await supabase
        .from('rooms')
        .update({ player1_name: playerName, updated_at: new Date().toISOString() })
        .eq('id', roomId);
      room.player1_name = playerName;
    }
    return { success: true, room: room as RoomRecord, slot: 'p1' };
  }

  // Case B: Player 2 reconnecting
  if (room.player2_id === playerId) {
    if (playerName && playerName !== room.player2_name) {
      await supabase
        .from('rooms')
        .update({ player2_name: playerName, updated_at: new Date().toISOString() })
        .eq('id', roomId);
      room.player2_name = playerName;
    }
    return { success: true, room: room as RoomRecord, slot: 'p2' };
  }

  // Case C: Empty Slot 2 (Friend joining for the first time)
  if (!room.player2_id) {
    const { data: updated, error: updateError } = await supabase
      .from('rooms')
      .update({
        player2_id: playerId,
        player2_name: playerName.trim() || 'Player 2',
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId)
      .is('player2_id', null)
      .select()
      .single();

    if (updateError || !updated) {
      return {
        success: false,
        error: 'Unable to take Player 2 slot. The room may have just been filled.',
      };
    }

    return { success: true, room: updated as RoomRecord, slot: 'p2' };
  }

  // Case D: Room already has two different authorized players! Block 3rd visitor
  return {
    success: false,
    error: 'Access denied: This private room already has two authorized players.',
  };
}

/**
 * Submits a move with atomic verification
 */
export async function submitAtomicMove(
  supabase: SupabaseClient,
  room: RoomRecord,
  playerId: string,
  cellIndex: number
): Promise<MoveResult> {
  const isP1 = room.player1_id === playerId;
  const isP2 = room.player2_id === playerId;

  if (!isP1 && !isP2) {
    return { success: false, error: 'You are not an authorized player in this room.' };
  }

  const mySymbol: PlayerSymbol = isP1 ? 'X' : 'O';

  if (!room.player2_id) {
    return { success: false, error: 'Waiting for your friend to join.' };
  }

  if (room.winner) {
    return { success: false, error: 'Game is already completed.' };
  }

  if (room.current_turn !== mySymbol) {
    return { success: false, error: "It's not your turn!" };
  }

  if (room.board[cellIndex] !== '') {
    return { success: false, error: 'That cell is already filled.' };
  }

  // 1. Try atomic database RPC function first
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'make_atomic_move',
      {
        p_room_id: room.id,
        p_player_id: playerId,
        p_cell_index: cellIndex,
      }
    );

    if (!rpcError && rpcData) {
      return { success: true, room: rpcData as RoomRecord };
    }

    if (rpcError && rpcError.message && !rpcError.message.includes('function') && !rpcError.message.includes('not found')) {
      return { success: false, error: rpcError.message };
    }
  } catch {
    // Continue to direct update fallback
  }

  // 2. Direct Fallback with optimistic concurrency control
  const newBoard = [...room.board];
  newBoard[cellIndex] = mySymbol;

  const { winner, line } = checkWinner(newBoard);
  const nextTurn: PlayerSymbol = mySymbol === 'X' ? 'O' : 'X';

  const updates: Partial<RoomRecord> = {
    board: newBoard,
    current_turn: winner ? room.current_turn : nextTurn,
    winner,
    winning_line: line,
    updated_at: new Date().toISOString(),
    p1_rematch_ready: false,
    p2_rematch_ready: false,
  };

  if (winner === 'X') updates.p1_score = room.p1_score + 1;
  else if (winner === 'O') updates.p2_score = room.p2_score + 1;
  else if (winner === 'DRAW') updates.draws = room.draws + 1;

  const { data: updated, error } = await supabase
    .from('rooms')
    .update(updates)
    .eq('id', room.id)
    .eq('current_turn', mySymbol) // Concurrency guard: only succeed if it was still my turn
    .is('winner', null) // Concurrency guard: only succeed if no winner was declared yet
    .select()
    .single();

  if (error || !updated) {
    return {
      success: false,
      error: error?.message || 'Move collision or outdated board. Re-synchronizing...',
    };
  }

  return { success: true, room: updated as RoomRecord };
}

/**
 * Request or confirm a rematch
 */
export async function triggerRematch(
  supabase: SupabaseClient,
  room: RoomRecord,
  playerId: string
): Promise<MoveResult> {
  const isP1 = room.player1_id === playerId;
  const isP2 = room.player2_id === playerId;

  if (!isP1 && !isP2) {
    return { success: false, error: 'Unauthorized.' };
  }

  // Try RPC first
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'request_rematch',
      {
        p_room_id: room.id,
        p_player_id: playerId,
      }
    );

    if (!rpcError && rpcData) {
      return { success: true, room: rpcData as RoomRecord };
    }
  } catch {
    // Continue to fallback
  }

  // Fallback: Check if both ready or start new match directly
  const nextStarter: PlayerSymbol = room.starter === 'X' ? 'O' : 'X';
  const otherReady = isP1 ? room.p2_rematch_ready : room.p1_rematch_ready;

  if (otherReady) {
    // Both agreed: Reset board!
    const { data: updated, error } = await supabase
      .from('rooms')
      .update({
        board: ['', '', '', '', '', '', '', '', ''],
        starter: nextStarter,
        current_turn: nextStarter,
        winner: null,
        winning_line: null,
        match_id: room.match_id + 1,
        p1_rematch_ready: false,
        p2_rematch_ready: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', room.id)
      .select()
      .single();

    if (error || !updated) {
      return { success: false, error: 'Failed to reset match.' };
    }
    return { success: true, room: updated as RoomRecord };
  } else {
    // Mark this player ready
    const updates: Partial<RoomRecord> = {
      p1_rematch_ready: isP1 ? true : room.p1_rematch_ready,
      p2_rematch_ready: isP2 ? true : room.p2_rematch_ready,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('id', room.id)
      .select()
      .single();

    if (error || !updated) {
      return { success: false, error: 'Failed to update rematch ready status.' };
    }
    return { success: true, room: updated as RoomRecord };
  }
}
