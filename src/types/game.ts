export type PlayerSymbol = 'X' | 'O';
export type PlayerSlot = 'p1' | 'p2';

export interface RoomRecord {
  id: string;
  passcode: string;
  player1_id: string;
  player1_name: string;
  player2_id: string | null;
  player2_name: string | null;
  board: string[];
  current_turn: PlayerSymbol;
  starter: PlayerSymbol;
  winner: PlayerSymbol | 'DRAW' | null;
  winning_line: number[] | null;
  match_id: number;
  p1_score: number;
  p2_score: number;
  draws: number;
  p1_rematch_ready: boolean;
  p2_rematch_ready: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlayerIdentity {
  id: string;
  name: string;
}

export type AuthorizedUsername = 'Ithal' | 'Sanu';

export interface AuthenticatedAccount {
  username: AuthorizedUsername;
  displayName: string;
  id: string;
  defaultSlot: PlayerSlot;
  defaultSymbol: PlayerSymbol;
}

export interface PlayerPresence {
  player_id: string;
  player_name: string;
  slot: PlayerSlot;
  online_at: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';
