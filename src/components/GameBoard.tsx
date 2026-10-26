import React, { useState, useEffect, useRef } from 'react';
import {
  AuthenticatedAccount,
  ChatMessage,
  ConnectionStatus,
  PlayerSlot,
  PlayerSymbol,
  RoomRecord,
} from '../types/game';
import {
  RotateCcw,
  WifiOff,
  Loader2,
  Sparkles,
  AlertTriangle,
  MessageCircle,
  X,
  Send,
} from 'lucide-react';

interface GameBoardProps {
  room: RoomRecord;
  account: AuthenticatedAccount;
  slot: PlayerSlot | null;
  symbol: PlayerSymbol | null;
  connectionStatus: ConnectionStatus;
  isFriendOnline: boolean;
  isMeOnline: boolean;
  friendName: string;
  messages: ChatMessage[];
  error: string | null;
  onMakeMove: (cellIndex: number) => Promise<boolean>;
  onRequestRematch: () => Promise<boolean>;
  onSendMessage: (text: string) => Promise<boolean>;
  onClearError: () => void;
}

const QUICK_SHOUTS = ['👋 Hey!', '🔥 Good move!', '😂 Oops!', '🤝 GG!', '🔄 Rematch?'];

export const GameBoard: React.FC<GameBoardProps> = ({
  room,
  account,
  slot,
  connectionStatus,
  isFriendOnline,
  isMeOnline,
  friendName,
  messages,
  error,
  onMakeMove,
  onRequestRematch,
  onSendMessage,
  onClearError,
}) => {
  const [submittingCell, setSubmittingCell] = useState<number | null>(null);
  const [rematchLoading, setRematchLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [lastSeenCount, setLastSeenCount] = useState(messages.length);
  const [popupBubble, setPopupBubble] = useState<ChatMessage | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const isP1 = slot === 'p1';
  const mySymbol: PlayerSymbol = isP1 ? 'X' : 'O';
  const friendSymbol: PlayerSymbol = isP1 ? 'O' : 'X';
  const isMyTurn = room.current_turn === mySymbol && !room.winner && isFriendOnline;

  const unreadCount = isChatOpen ? 0 : Math.max(0, messages.length - lastSeenCount);

  // When a new message arrives from the friend, popup directly on the game screen!
  useEffect(() => {
    if (messages.length > 0) {
      const latest = messages[messages.length - 1];
      if (latest.senderId !== account.id) {
        setPopupBubble(latest);
        const timer = setTimeout(() => {
          setPopupBubble(null);
        }, 4000);
        return () => clearTimeout(timer);
      }
    }
  }, [messages, account.id]);

  // Auto scroll chat to bottom when opened or on new message
  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      chatInputRef.current?.focus();
    }
  }, [isChatOpen, messages]);

  const handleToggleChat = () => {
    const nextState = !isChatOpen;
    setIsChatOpen(nextState);
    setLastSeenCount(messages.length);
    setPopupBubble(null);
  };

  const handleSendChat = async (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text) return;

    if (!textToSend) setChatInput('');
    await onSendMessage(text);
    setTimeout(() => chatInputRef.current?.focus(), 50);
  };

  const handleCellClick = async (index: number) => {
    if (!isMyTurn || room.board[index] !== '' || submittingCell !== null) return;
    setSubmittingCell(index);
    try {
      await onMakeMove(index);
    } finally {
      setSubmittingCell(null);
    }
  };

  const handleRematchClick = async () => {
    setRematchLoading(true);
    try {
      await onRequestRematch();
    } finally {
      setRematchLoading(false);
    }
  };

  const isWinningCell = (index: number): boolean => {
    return Boolean(room.winning_line?.includes(index));
  };

  const isCurrentPlayerReadyForRematch = isP1 ? room.p1_rematch_ready : room.p2_rematch_ready;

  return (
    <div className="w-full max-w-md mx-auto px-3 sm:px-4 py-2 flex flex-col items-center select-none relative">
      {/* Real-time In-Game Message Popup Bubble on Game Screen */}
      {popupBubble && !isChatOpen && (
        <div
          onClick={handleToggleChat}
          className="w-full max-w-[350px] mb-2 px-3.5 py-2 bg-slate-900 border-2 border-cyan-400 rounded-2xl text-xs text-white shadow-2xl flex items-center justify-between gap-2 cursor-pointer animate-bounce"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
            <span className="font-black text-cyan-300 font-display shrink-0">
              {popupBubble.senderName}:
            </span>
            <span className="truncate text-slate-200">{popupBubble.text}</span>
          </div>
          <span className="text-[10px] text-cyan-400 font-bold shrink-0">Reply &rarr;</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="w-full max-w-[350px] mb-2 p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-1.5 truncate">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <button
            onClick={onClearError}
            className="text-[11px] text-rose-400 hover:text-white underline cursor-pointer shrink-0 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Compact Scoreboard & Status Header */}
      <div className="w-full max-w-[350px] bg-slate-950/90 border border-slate-800/90 rounded-2xl p-2.5 mb-2.5 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          {/* Ithal (X) */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isP1
                  ? isMeOnline && connectionStatus === 'connected'
                    ? 'bg-cyan-400 shadow-[0_0_8px_#38bdf8]'
                    : 'bg-amber-400 animate-pulse'
                  : isFriendOnline
                  ? 'bg-cyan-400 shadow-[0_0_8px_#38bdf8]'
                  : 'bg-rose-500'
              }`}
            />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-cyan-300 truncate font-display">
                Ithal <span className="text-[10px] text-cyan-400/80">(X)</span>
              </span>
              <span className="text-lg font-black text-white tabular-nums leading-tight">
                {room.p1_score}
              </span>
            </div>
          </div>

          {/* Turn / Outcome Status */}
          <div className="flex-1 flex justify-center px-1">
            {room.winner ? (
              <div
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm ${
                  room.winner === mySymbol
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : room.winner === 'DRAW'
                    ? 'bg-slate-800 text-slate-300 border border-slate-700'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">
                  {room.winner === 'DRAW'
                    ? 'Draw!'
                    : room.winner === mySymbol
                    ? 'You Won!'
                    : `${friendName} Won!`}
                </span>
              </div>
            ) : !isFriendOnline ? (
              <div className="px-2.5 py-1 rounded-full bg-rose-950/60 border border-rose-800/80 text-rose-300 text-[11px] font-bold flex items-center gap-1.5 animate-pulse">
                <WifiOff className="w-3 h-3 text-rose-400 shrink-0" />
                <span className="truncate">{friendName} is offline</span>
              </div>
            ) : (
              <div
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isMyTurn
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isMyTurn ? 'bg-cyan-400 animate-ping' : 'bg-slate-500'
                  }`}
                />
                <span className="truncate">
                  {isMyTurn ? 'Your Turn' : `${friendName}'s Turn`}
                </span>
              </div>
            )}
          </div>

          {/* Sanu (O) */}
          <div className="flex items-center gap-2 min-w-0 justify-end">
            <div className="flex flex-col items-end min-w-0">
              <span className="text-xs font-bold text-fuchsia-300 truncate font-display">
                Sanu <span className="text-[10px] text-fuchsia-400/80">(O)</span>
              </span>
              <span className="text-lg font-black text-white tabular-nums leading-tight">
                {room.p2_score}
              </span>
            </div>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                !isP1
                  ? isMeOnline && connectionStatus === 'connected'
                    ? 'bg-fuchsia-400 shadow-[0_0_8px_#e879f9]'
                    : 'bg-amber-400 animate-pulse'
                  : isFriendOnline
                  ? 'bg-fuchsia-400 shadow-[0_0_8px_#e879f9]'
                  : 'bg-rose-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* GAME BOARD CONTAINER */}
      <div className="relative w-[min(90vw,350px)] h-[min(90vw,350px)] aspect-square bg-slate-950/95 border-2 border-slate-800 rounded-3xl p-2.5 sm:p-3 shadow-2xl shadow-cyan-950/30 overflow-hidden">
        {/* Offline Overlay */}
        {!isFriendOnline && (
          <div className="absolute inset-0 z-20 bg-slate-950/85 backdrop-blur-xs rounded-3xl flex flex-col items-center justify-center p-4 text-center animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-rose-950/80 border border-rose-800/80 flex items-center justify-center mb-2">
              <WifiOff className="w-5 h-5 text-rose-400 animate-pulse" />
            </div>
            <p className="text-sm font-bold text-white font-display">
              {friendName} is offline
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              The game is paused until {friendName} reconnects.
            </p>
          </div>
        )}

        {/* IN-GAME CHAT POPUP ON THE GAME SCREEN ONLY */}
        {isChatOpen && (
          <div className="absolute inset-0 z-30 bg-slate-900/95 backdrop-blur-md rounded-3xl flex flex-col p-3 shadow-2xl border-2 border-cyan-500/60 animate-fade-in">
            {/* Chat Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white font-display">
                  Chat with {friendName}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isFriendOnline ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                />
              </div>
              <button
                onClick={handleToggleChat}
                className="p-1 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Shouts Bar */}
            <div className="py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
              {QUICK_SHOUTS.map((shout, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendChat(shout)}
                  className="px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 shrink-0 transition-colors cursor-pointer"
                >
                  {shout}
                </button>
              ))}
            </div>

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1 text-xs">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-[11px]">
                  Say hi to {friendName}!
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === account.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-3 py-1.5 rounded-2xl break-words ${
                          isMe
                            ? 'bg-cyan-600 text-white rounded-tr-xs'
                            : 'bg-slate-800 text-slate-100 rounded-tl-xs border border-slate-700'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="pt-2 border-t border-slate-800 shrink-0 flex items-center gap-1.5">
              <input
                ref={chatInputRef}
                type="text"
                maxLength={120}
                placeholder={`Type message...`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-full text-white text-xs outline-none focus:border-cyan-400 placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => handleSendChat()}
                disabled={!chatInput.trim()}
                className="w-7 h-7 rounded-full bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 flex items-center justify-center cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>
          </div>
        )}

        {/* 3x3 Grid Cells */}
        <div className="grid grid-cols-3 grid-rows-3 gap-2 w-full h-full">
          {room.board.map((cellValue, idx) => {
            const winning = isWinningCell(idx);
            const isFilled = cellValue !== '';
            const canClick = isMyTurn && !isFilled && submittingCell === null;

            return (
              <button
                key={idx}
                type="button"
                disabled={!canClick}
                onClick={() => handleCellClick(idx)}
                aria-label={`Cell ${idx + 1}, ${cellValue || 'empty'}`}
                className={`grid-board-cell relative w-full h-full rounded-2xl flex items-center justify-center text-4xl sm:text-5xl font-black font-display select-none transition-all ${
                  winning
                    ? cellValue === 'X'
                      ? 'bg-cyan-500/25 border-2 border-cyan-400 text-cyan-300 glow-cyan'
                      : 'bg-fuchsia-500/25 border-2 border-fuchsia-400 text-fuchsia-300 glow-fuchsia'
                    : isFilled
                    ? 'bg-slate-900/90 border border-slate-800'
                    : canClick
                    ? 'bg-slate-900/50 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700 cursor-pointer active:scale-95'
                    : 'bg-slate-900/30 border border-slate-850 cursor-not-allowed opacity-80'
                }`}
              >
                {cellValue === 'X' && (
                  <span className="text-cyan-400 glow-cyan transform transition-transform scale-100">
                    X
                  </span>
                )}
                {cellValue === 'O' && (
                  <span className="text-fuchsia-400 glow-fuchsia transform transition-transform scale-100">
                    O
                  </span>
                )}
                {!cellValue && isMyTurn && canClick && (
                  <span className="opacity-0 hover:opacity-20 text-slate-500 transition-opacity">
                    {mySymbol}
                  </span>
                )}
                {submittingCell === idx && (
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin absolute" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Controls Bar (No Share Button) */}
      <div className="w-full max-w-[350px] mt-3 flex items-center justify-center gap-2">
        {/* Toggle Live Chat on the Game Screen */}
        <button
          onClick={handleToggleChat}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ${
            isChatOpen
              ? 'bg-cyan-500 text-slate-950 font-black'
              : 'bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-white'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>{isChatOpen ? 'Close Chat' : 'Live Chat'}</span>
          {unreadCount > 0 && !isChatOpen && (
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-400 text-slate-950 font-black text-[10px] animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Rematch Button */}
        {room.winner && (
          <button
            onClick={handleRematchClick}
            disabled={rematchLoading || !isFriendOnline || isCurrentPlayerReadyForRematch}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md ${
              isCurrentPlayerReadyForRematch
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800 cursor-default'
                : 'bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-400 hover:to-fuchsia-500 text-white cursor-pointer active:scale-95'
            }`}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${rematchLoading ? 'animate-spin' : ''}`} />
            <span>
              {isCurrentPlayerReadyForRematch
                ? 'Ready (1/2)'
                : isP1 && room.p2_rematch_ready
                ? 'Accept Rematch'
                : !isP1 && room.p1_rematch_ready
                ? 'Accept Rematch'
                : 'Play Again'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
