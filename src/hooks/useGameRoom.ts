import { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  AuthenticatedAccount,
  ChatMessage,
  ConnectionStatus,
  PlayerIdentity,
  PlayerSlot,
  PlayerSymbol,
  RoomRecord,
} from '../types/game';
import { getSupabaseClient, getSupabaseCredentials } from '../lib/supabase';
import {
  authenticateUser,
  getStoredSession,
  saveSession,
  clearSession,
  SHARED_ROOM_ID,
} from '../lib/identity';
import {
  getOrCreateDedicatedIthalSanuRoom,
  submitAtomicMove,
  triggerRematch,
} from '../lib/gameService';
import {
  playClickSound,
  playDrawSound,
  playFriendJoinedSound,
  playMoveSound,
  playWinSound,
  playMessageSound,
} from '../lib/audio';
import confetti from 'canvas-confetti';

interface UseGameRoomReturn {
  room: RoomRecord | null;
  account: AuthenticatedAccount | null;
  player: PlayerIdentity;
  slot: PlayerSlot | null;
  symbol: PlayerSymbol | null;
  connectionStatus: ConnectionStatus;
  isFriendOnline: boolean;
  isMeOnline: boolean;
  friendName: string;
  messages: ChatMessage[];
  error: string | null;
  isLoading: boolean;
  isSupabaseConnected: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  makeMove: (cellIndex: number) => Promise<boolean>;
  requestRematch: () => Promise<boolean>;
  sendMessage: (text: string) => Promise<boolean>;
  clearError: () => void;
}

export function useGameRoom(): UseGameRoomReturn {
  const [account, setAccount] = useState<AuthenticatedAccount | null>(getStoredSession);
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [slot, setSlot] = useState<PlayerSlot | null>(() => account?.defaultSlot || null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [isFriendOnline, setIsFriendOnline] = useState<boolean>(false);
  const [isMeOnline, setIsMeOnline] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const disconnectTimerRef = useRef<number | null>(null);

  const { isConfigured: isSupabaseConnected } = getSupabaseCredentials();

  const mySymbol: PlayerSymbol | null =
    account?.defaultSymbol || (slot === 'p1' ? 'X' : slot === 'p2' ? 'O' : null);
  const friendName: string = account?.username === 'Ithal' ? 'Sanu' : 'Ithal';

  const player: PlayerIdentity = account
    ? { id: account.id, name: account.displayName }
    : { id: 'anon', name: 'Player' };

  // Clear transient error
  const clearError = useCallback(() => setError(null), []);

  // Update room state from server
  const handleRoomUpdate = useCallback((newRoom: RoomRecord) => {
    setRoom((prev) => {
      if (!prev) return newRoom;

      // Detect move sound
      const moveHappened =
        JSON.stringify(prev.board) !== JSON.stringify(newRoom.board);
      if (moveHappened) {
        for (let i = 0; i < 9; i++) {
          if (prev.board[i] === '' && newRoom.board[i] !== '') {
            playMoveSound(newRoom.board[i] as 'X' | 'O');
            break;
          }
        }
      }

      // Detect outcome
      if (!prev.winner && newRoom.winner) {
        if (newRoom.winner === 'DRAW') {
          playDrawSound();
        } else {
          playWinSound();
          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
              colors:
                newRoom.winner === 'X'
                  ? ['#38bdf8', '#0284c7', '#ffffff']
                  : ['#e879f9', '#c026d3', '#ffffff'],
            });
          } catch {
            // ignore
          }
        }
      }

      return newRoom;
    });
  }, []);

  // Setup Realtime & Presence subscriptions (via Server SSE for cross-device + Supabase)
  // Setup Realtime & Presence subscriptions
  const setupRealtimeSubscriptions = useCallback(
    (currentAccount: AuthenticatedAccount, targetRoomId: string) => {
      const targetFriendId =
        currentAccount.username === 'Ithal' ? 'user_sanu' : 'user_ithal';

      // 1. Clean up existing connections
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      setConnectionStatus('connecting');

      // 2. Supabase Realtime integration (Primary for Vercel Free Hosting)
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const channel = supabase.channel(`duoxo_${targetRoomId}`, {
            config: { presence: { key: currentAccount.id } },
          });
          channelRef.current = channel;

          // Realtime Room State Updates
          channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${targetRoomId}` },
            (payload) => {
              if (payload.new) handleRoomUpdate(payload.new as RoomRecord);
            }
          );

          // Realtime Presence Tracking
          channel.on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const presentPlayerIds = Object.keys(state);
            const friendIsUp = presentPlayerIds.includes(targetFriendId);
            setIsFriendOnline(friendIsUp);
          });

          // Realtime Live Chat Broadcast
          channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
            if (payload) {
              const msg = payload as ChatMessage;
              setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
              });
              if (msg.senderId !== currentAccount.id) {
                playMessageSound();
              }
            }
          });

          channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              setConnectionStatus('connected');
              setIsMeOnline(true);
              await channel.track({
                player_id: currentAccount.id,
                player_name: currentAccount.displayName,
                slot: currentAccount.defaultSlot,
                online_at: Date.now(),
              });
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setConnectionStatus('reconnecting');
            }
          });

          return;
        } catch (err) {
          console.error('Supabase channel connection error:', err);
        }
      }

      // 3. Fallback: SSE on Local Server backend (when running server.ts locally)
      try {
        const sseUrl = `/api/room/events?room=${targetRoomId}&playerId=${currentAccount.id}&name=${encodeURIComponent(currentAccount.displayName)}`;
        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          setConnectionStatus('connected');
          setIsMeOnline(true);
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'INIT') {
              if (data.room) handleRoomUpdate(data.room);
              if (Array.isArray(data.online)) {
                const friendIsUp = data.online.includes(targetFriendId);
                setIsFriendOnline(friendIsUp);
              }
              if (Array.isArray(data.messages)) {
                setMessages(data.messages);
              }
            } else if (data.type === 'PRESENCE') {
              if (Array.isArray(data.online)) {
                const friendIsUp = data.online.includes(targetFriendId);
                if (friendIsUp) {
                  setIsFriendOnline(true);
                  if (disconnectTimerRef.current) {
                    clearTimeout(disconnectTimerRef.current);
                    disconnectTimerRef.current = null;
                  }
                } else {
                  if (!disconnectTimerRef.current) {
                    disconnectTimerRef.current = window.setTimeout(() => {
                      setIsFriendOnline(false);
                      disconnectTimerRef.current = null;
                    }, 1800);
                  }
                }
              }
            } else if (data.type === 'ROOM_UPDATE') {
              if (data.room) handleRoomUpdate(data.room);
            } else if (data.type === 'CHAT_MESSAGE' && data.message) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === data.message.id)) return prev;
                return [...prev, data.message];
              });
              if (data.message.senderId !== currentAccount.id) {
                playMessageSound();
              }
            }
          } catch {
            // ignore non-json keep-alive
          }
        };

        es.onerror = () => {
          setConnectionStatus('reconnecting');
        };
      } catch (err) {
        console.error('SSE connection error:', err);
      }

      // 4. Same-browser tab fallback
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          if (broadcastChannelRef.current) broadcastChannelRef.current.close();
          const bc = new BroadcastChannel(`duoxo_${targetRoomId}`);
          broadcastChannelRef.current = bc;
          bc.onmessage = (event) => {
            const data = event.data;
            if (!data) return;
            if (data.type === 'HEARTBEAT' && data.playerId === targetFriendId) {
              setIsFriendOnline(true);
            } else if (data.type === 'SYNC_STATE' && data.room) {
              handleRoomUpdate(data.room);
            }
          };
          bc.postMessage({ type: 'HEARTBEAT', playerId: currentAccount.id });
        }
      } catch {
        // ignore
      }
    },
    [handleRoomUpdate]
  );

  // Connect to shared room
  const connectToSharedRoom = useCallback(
    async (currentAccount: AuthenticatedAccount) => {
      setIsLoading(true);
      setError(null);

      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const joinRes = await getOrCreateDedicatedIthalSanuRoom(supabase, currentAccount);
          if (joinRes.success && joinRes.room) {
            setRoom(joinRes.room);
            setSlot(joinRes.slot || currentAccount.defaultSlot);
          } else if (joinRes.error) {
            setError(joinRes.error);
          }
        } catch (err) {
          console.error('Supabase room join error:', err);
        } finally {
          setIsLoading(false);
        }
        setupRealtimeSubscriptions(currentAccount, SHARED_ROOM_ID);
        return;
      }

      // Fallback: Fetch current authoritative server room state first
      try {
        const res = await fetch(`/api/room/state?room=${SHARED_ROOM_ID}`);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.room) {
            setRoom(data.room);
            setSlot(currentAccount.defaultSlot);
            const targetFriendId = currentAccount.username === 'Ithal' ? 'user_sanu' : 'user_ithal';
            if (Array.isArray(data.online) && data.online.includes(targetFriendId)) {
              setIsFriendOnline(true);
            }
          }
        } else {
          // Running on Vercel without Supabase configured yet: provide offline/local state
          setRoom({
            id: SHARED_ROOM_ID,
            passcode: 'ithal_sanu_private_2026',
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
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          setSlot(currentAccount.defaultSlot);
        }
      } catch (err) {
        console.warn('Initial state fetch error, relying on SSE:', err);
      } finally {
        setIsLoading(false);
      }

      setupRealtimeSubscriptions(currentAccount, SHARED_ROOM_ID);
    },
    [setupRealtimeSubscriptions]
  );

  // Auto-connect on mount if session exists
  useEffect(() => {
    const existing = getStoredSession();
    if (existing) {
      setAccount(existing);
      setSlot(existing.defaultSlot);
      connectToSharedRoom(existing);
    }
  }, [connectToSharedRoom]);

  // Login handler
  const login = async (username: string, password: string): Promise<boolean> => {
    setError(null);
    playClickSound();

    const authRes = authenticateUser(username, password);
    if (!authRes.success || !authRes.account) {
      setError(authRes.error || 'Authentication failed.');
      return false;
    }

    saveSession(authRes.account);
    setAccount(authRes.account);
    setSlot(authRes.account.defaultSlot);

    await connectToSharedRoom(authRes.account);
    return true;
  };

  // Logout handler
  const logout = useCallback(() => {
    playClickSound();
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (channelRef.current) {
      try {
        channelRef.current.untrack();
        channelRef.current.unsubscribe();
      } catch {
        // ignore
      }
      channelRef.current = null;
    }
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.close();
      } catch {
        // ignore
      }
      broadcastChannelRef.current = null;
    }
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }

    clearSession();
    setAccount(null);
    setRoom(null);
    setSlot(null);
    setIsFriendOnline(false);
    setIsMeOnline(false);
    setConnectionStatus('idle');
  }, []);

  // Move submission
  const makeMove = async (cellIndex: number): Promise<boolean> => {
    if (!room || !account || !mySymbol) return false;

    if (!isFriendOnline) {
      setError(`${friendName} is offline. Game is paused until they return.`);
      return false;
    }

    if (room.winner) return false;
    if (room.current_turn !== mySymbol) {
      setError("It's not your turn!");
      return false;
    }
    if (room.board[cellIndex] !== '') return false;

    setError(null);
    playClickSound();

    // 1. Submit via Supabase if configured
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const moveRes = await submitAtomicMove(supabase, room, account.id, cellIndex);
        if (!moveRes.success) {
          setError(moveRes.error || 'Invalid move.');
          return false;
        }
        if (moveRes.room) {
          handleRoomUpdate(moveRes.room);
        }
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to submit move.');
        return false;
      }
    }

    // 2. Submit move to backend API fallback
    try {
      const res = await fetch('/api/room/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          playerId: account.id,
          cellIndex,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Invalid move.');
        return false;
      }

      const data = await res.json();
      if (data.room) {
        handleRoomUpdate(data.room);
      }
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send move.');
      return false;
    }
  };

  // Rematch
  const requestRematch = async (): Promise<boolean> => {
    if (!room || !account) return false;
    if (!isFriendOnline) {
      setError(`Both you and ${friendName} must be online before starting a rematch.`);
      return false;
    }

    setError(null);
    playClickSound();

    // 1. Supabase Rematch if configured
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const rematchRes = await triggerRematch(supabase, room, account.id);
        if (!rematchRes.success) {
          setError(rematchRes.error || 'Failed to request rematch.');
          return false;
        }
        if (rematchRes.room) {
          handleRoomUpdate(rematchRes.room);
        }
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to request rematch.');
        return false;
      }
    }

    // 2. Fallback to API
    try {
      const res = await fetch('/api/room/rematch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          playerId: account.id,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to request rematch.');
        return false;
      }

      const data = await res.json();
      if (data.room) {
        handleRoomUpdate(data.room);
      }
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to request rematch.');
      return false;
    }
  };

  // Send Live Chat Message
  const sendMessage = async (text: string): Promise<boolean> => {
    if (!room || !account || !text.trim()) return false;
    const cleanText = text.trim().slice(0, 150);

    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: account.id,
      senderName: account.displayName,
      text: cleanText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, msg]);

    // Broadcast through Supabase Channel
    const supabase = getSupabaseClient();
    if (supabase && channelRef.current) {
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'chat',
          payload: msg,
        });
        return true;
      } catch (err) {
        console.error('Supabase chat broadcast error:', err);
      }
    }

    // Fallback to API
    try {
      const res = await fetch('/api/room/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          senderId: account.id,
          senderName: account.displayName,
          text: cleanText,
        }),
      });
      return res.ok;
    } catch (err) {
      console.error('Failed to send message:', err);
      return false;
    }
  };

  return {
    room,
    account,
    player,
    slot,
    symbol: mySymbol,
    connectionStatus,
    isFriendOnline,
    isMeOnline,
    friendName,
    messages,
    error,
    isLoading,
    isSupabaseConnected,
    login,
    logout,
    makeMove,
    requestRematch,
    sendMessage,
    clearError,
  };
}
