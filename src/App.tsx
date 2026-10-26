/**
 * DuoXO - Private Real-Time Tic-Tac-Toe for Two Friends
 * Direct Two-User Access for Ithal (X) and Sanu (O) with Live Chat
 */

import { useState } from 'react';
import { useGameRoom } from './hooks/useGameRoom';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { GameBoard } from './components/GameBoard';
import { SupabaseSetupModal } from './components/SupabaseSetupModal';

export default function App() {
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const {
    room,
    account,
    slot,
    symbol,
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
  } = useGameRoom();

  return (
    <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Clean Navbar */}
      <Navbar
        account={account}
        isSupabaseConnected={isSupabaseConnected}
        onOpenSetup={() => setIsSetupOpen(true)}
        onLogout={logout}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center items-center relative overflow-hidden py-2 sm:py-6">
        {account && room ? (
          <GameBoard
            room={room}
            account={account}
            slot={slot}
            symbol={symbol}
            connectionStatus={connectionStatus}
            isFriendOnline={isFriendOnline}
            isMeOnline={isMeOnline}
            friendName={friendName}
            messages={messages}
            error={error}
            onMakeMove={makeMove}
            onRequestRematch={requestRematch}
            onSendMessage={sendMessage}
            onClearError={clearError}
          />
        ) : (
          <LoginScreen
            isLoading={isLoading}
            error={error}
            onLogin={login}
            onClearError={clearError}
          />
        )}
      </main>

      {/* Supabase Database Connection Modal */}
      <SupabaseSetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
      />
    </div>
  );
}
