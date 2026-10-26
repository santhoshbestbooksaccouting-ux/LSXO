import React, { useState } from 'react';
import { X, Check, Copy, ExternalLink, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { clearSupabaseCredentials, getSupabaseClient, getSupabaseCredentials, saveSupabaseCredentials } from '../lib/supabase';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCHEMA = `-- DuoXO Private Real-time XO Schema
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
CREATE POLICY "Public can view rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Public can create rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Players can update room" ON public.rooms FOR UPDATE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;

INSERT INTO public.rooms (
  id, passcode, player1_id, player1_name, player2_id, player2_name,
  board, current_turn, starter, match_id, p1_score, p2_score, draws
) VALUES (
  'room_ithal_sanu', 'ithal_sanu_private_2026', 'user_ithal', 'Ithal', 'user_sanu', 'Sanu',
  '["","","","","","","","",""]'::jsonb, 'X', 'X', 1, 0, 0, 0
)
ON CONFLICT (id) DO NOTHING;`;

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const creds = getSupabaseCredentials();
  const [url, setUrl] = useState(creds.url);
  const [anonKey, setAnonKey] = useState(creds.anonKey);
  const [copiedSql, setCopiedSql] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleSave = () => {
    if (!url.trim() || !anonKey.trim()) {
      alert('Please fill in both Supabase URL and Anon Key.');
      return;
    }
    saveSupabaseCredentials(url.trim(), anonKey.trim());
    window.location.reload();
  };

  const handleReset = () => {
    clearSupabaseCredentials();
    window.location.reload();
  };

  const handleTestConnection = async () => {
    setTestResult({ status: 'testing', message: 'Testing connection to Supabase...' });
    const client = getSupabaseClient();
    if (!client) {
      setTestResult({
        status: 'error',
        message: 'No credentials configured yet. Save credentials first.',
      });
      return;
    }

    try {
      const { error } = await client.from('rooms').select('id').limit(1);
      if (error) {
        if (error.code === '42P01') {
          setTestResult({
            status: 'error',
            message: 'Connected to Supabase, but "rooms" table was not found. Please run the SQL schema below in the SQL Editor.',
          });
        } else {
          setTestResult({
            status: 'error',
            message: `Connection failed: ${error.message}`,
          });
        }
      } else {
        setTestResult({
          status: 'success',
          message: 'Success! Connected to Supabase and "rooms" table is ready for real-time play.',
        });
      }
    } catch (err: unknown) {
      setTestResult({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown connection error.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h3 className="text-base font-semibold text-white font-display">
              Supabase Realtime & Database Configuration
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Status banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              creds.isConfigured
                ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
            }`}
          >
            {creds.isConfigured ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold text-white">
                {creds.isConfigured
                  ? `Supabase is connected (Source: ${creds.source})`
                  : 'Supabase credentials not detected in environment'}
              </p>
              <p className="text-xs text-slate-300">
                {creds.isConfigured
                  ? 'Real-time presence tracking, room state persistence, and authoritative moves are enabled.'
                  : 'You can test locally across tabs, or paste your Supabase Project URL and Anon Key below to enable multi-device remote play.'}
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                VITE_SUPABASE_URL
              </label>
              <input
                type="text"
                placeholder="https://xyzproject.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                VITE_SUPABASE_ANON_KEY (Public Key)
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Use only your public <code className="text-slate-400">anon</code> key. Never use service_role keys.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs rounded-lg shadow-sm transition-all"
              >
                Save & Apply Credentials
              </button>
              {creds.source === 'storage' && (
                <button
                  onClick={handleReset}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
                >
                  Clear Stored Keys
                </button>
              )}
              <button
                onClick={handleTestConnection}
                disabled={testResult.status === 'testing'}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors flex items-center gap-1.5 ml-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testResult.status === 'testing' ? 'animate-spin' : ''}`} />
                <span>Test DB Table</span>
              </button>
            </div>

            {testResult.message && (
              <div
                className={`p-3 rounded-lg text-xs border ${
                  testResult.status === 'success'
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                    : testResult.status === 'error'
                    ? 'bg-rose-950/40 text-rose-300 border-rose-800/40'
                    : 'bg-slate-800/60 text-slate-300 border-slate-700'
                }`}
              >
                {testResult.message}
              </div>
            )}
          </div>

          {/* Quick Setup Instructions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-white text-xs uppercase tracking-wider">
                SQL Schema Setup (Run once in Supabase)
              </h4>
              <button
                onClick={handleCopySql}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Script'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-400 overflow-x-auto max-h-40">
              {SQL_SCHEMA}
            </pre>
            <div className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
              <li>1. Open your Supabase Dashboard &rarr; SQL Editor.</li>
              <li>2. Click &quot;New Query&quot;, paste the SQL snippet above, and click &quot;Run&quot;.</li>
              <li>3. Realtime replication and Row Level Security will be configured automatically.</li>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center text-xs">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-cyan-400 hover:underline"
          >
            <span>Supabase Dashboard</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
