import React from 'react';
import { Database, LogOut, User } from 'lucide-react';
import { AuthenticatedAccount } from '../types/game';

interface NavbarProps {
  account: AuthenticatedAccount | null;
  isSupabaseConnected?: boolean;
  onOpenSetup?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  account,
  isSupabaseConnected,
  onOpenSetup,
  onLogout,
}) => {
  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-md mx-auto px-4 h-13 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-fuchsia-600 flex items-center justify-center font-black text-white text-xs tracking-wider shadow-sm font-display">
            LS
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight text-white font-display">
            LS
          </span>
        </div>

        {/* Database & User Pill & Logout */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenSetup && (
            <button
              onClick={onOpenSetup}
              title={isSupabaseConnected ? 'Supabase Connected' : 'Configure Supabase Database'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-900 border border-slate-800 transition-colors cursor-pointer relative"
            >
              <Database className="w-4 h-4" />
              <span
                className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                  isSupabaseConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-amber-500 animate-pulse'
                }`}
              />
            </button>
          )}

          {account && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-white">
              <User className="w-3 h-3 text-slate-400" />
              <span>{account.displayName}</span>
              <span
                className={`w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center font-display ${
                  account.defaultSymbol === 'X'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'bg-fuchsia-500/20 text-fuchsia-300'
                }`}
              >
                {account.defaultSymbol}
              </span>
            </div>
          )}

          {account && onLogout && (
            <button
              onClick={onLogout}
              title="Sign out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 border border-slate-800 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
