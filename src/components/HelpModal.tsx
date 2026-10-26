import React from 'react';
import { X, ShieldCheck, Wifi, UserCheck, KeyRound } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <h3 className="text-base font-semibold text-white font-display">
            Direct Access: Ithal &amp; Sanu Credentials
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed">
          {/* Credentials Card */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-cyan-400">
              <KeyRound className="w-4 h-4" />
              <span>Authorized Logins (No Room Code Required)</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <p className="text-cyan-400 font-bold">User: Ithal</p>
                <p className="text-slate-400">Pass: Ithal7</p>
                <p className="text-[10px] text-slate-500 font-sans mt-0.5">Player 1 (X)</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <p className="text-fuchsia-400 font-bold">User: Sanu</p>
                <p className="text-slate-400">Pass: Sanu9</p>
                <p className="text-[10px] text-slate-500 font-sans mt-0.5">Player 2 (O)</p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
            <div className="flex items-center gap-2 font-semibold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Direct Shared Private Arena</span>
            </div>
            <p className="text-slate-400">
              You do not need to create or configure any rooms. Simply enter your credentials and both of you are immediately connected to the same private match.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
            <div className="flex items-center gap-2 font-semibold text-fuchsia-400">
              <Wifi className="w-4 h-4" />
              <span>Online / Offline Detection &amp; Pause</span>
            </div>
            <p className="text-slate-400">
              When both of you are logged in, the game starts. If either of you leaves, closes the tab, or loses connection, the match automatically pauses with &quot;Your friend is offline&quot; until reconnection.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
            <div className="flex items-center gap-2 font-semibold text-blue-400">
              <UserCheck className="w-4 h-4" />
              <span>Multi-Tab Testing</span>
            </div>
            <p className="text-slate-400">
              Want to test on one computer? Open one tab as Ithal and a second tab (or Incognito window) as Sanu. Both will instantly discover each other and play!
            </p>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium text-xs cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
