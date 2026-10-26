import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Lock, User, Eye, EyeOff, AlertCircle, RotateCw, ArrowRight } from 'lucide-react';
import { playClickSound } from '../lib/audio';

interface LoginScreenProps {
  isLoading: boolean;
  error: string | null;
  onLogin: (username: string, password: string) => Promise<boolean>;
  onClearError: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  isLoading,
  error,
  onLogin,
  onClearError,
}) => {
  const [step, setStep] = useState<'username' | 'password'>('username');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationDegree, setRotationDegree] = useState(0);

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const autoSpinTimerRef = useRef<number | null>(null);
  const autoSubmitTimerRef = useRef<number | null>(null);

  // Auto-focus username input on load
  useEffect(() => {
    usernameInputRef.current?.focus();
    return () => {
      if (autoSpinTimerRef.current) clearTimeout(autoSpinTimerRef.current);
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    };
  }, []);

  // Clockwise spin transition into Password
  const triggerClockwiseSpinToPassword = (targetUser?: string) => {
    if (isRotating) return;
    playClickSound();
    onClearError();

    const finalUser =
      targetUser || (username.trim().toLowerCase() === 'ithal' ? 'Ithal' : 'Sanu');
    setUsername(finalUser);

    setIsRotating(true);
    setRotationDegree((prev) => prev + 360);

    setTimeout(() => {
      setStep('password');
      setIsRotating(false);
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 80);
    }, 450);
  };

  // Clockwise spin back to Username
  const triggerClockwiseSpinToUsername = () => {
    if (isRotating) return;
    playClickSound();
    onClearError();

    setIsRotating(true);
    setRotationDegree((prev) => prev + 360);

    setTimeout(() => {
      setStep('username');
      setIsRotating(false);
      setTimeout(() => {
        usernameInputRef.current?.focus();
        usernameInputRef.current?.select();
      }, 80);
    }, 450);
  };

  // Automatically spin clockwise when Ithal or Sanu is entered!
  const handleUsernameChange = (val: string) => {
    onClearError();
    setUsername(val);

    const clean = val.trim().toLowerCase();
    if (clean === 'ithal' || clean === 'sanu') {
      if (autoSpinTimerRef.current) {
        clearTimeout(autoSpinTimerRef.current);
      }
      autoSpinTimerRef.current = window.setTimeout(() => {
        triggerClockwiseSpinToPassword(clean === 'ithal' ? 'Ithal' : 'Sanu');
      }, 250);
    }
  };

  const handleUsernameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const clean = username.trim().toLowerCase();
      if (clean === 'ithal' || clean === 'sanu') {
        triggerClockwiseSpinToPassword(clean === 'ithal' ? 'Ithal' : 'Sanu');
      } else if (clean) {
        triggerClockwiseSpinToPassword(clean.charAt(0).toUpperCase() + clean.slice(1));
      }
    }
  };

  // Auto-submit when password matches
  const handlePasswordChange = (val: string) => {
    onClearError();
    setPassword(val);

    const userClean = username.trim().toLowerCase();
    if (
      (userClean === 'ithal' && val === 'Ithal7') ||
      (userClean === 'sanu' && val === 'Sanu9')
    ) {
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
      }
      autoSubmitTimerRef.current = window.setTimeout(() => {
        onLogin(userClean === 'ithal' ? 'Ithal' : 'Sanu', val);
      }, 280);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    await onLogin(username.trim(), password);
  };

  const normalizedUser = username.trim().toLowerCase();
  const matchedUser =
    normalizedUser === 'ithal' ? 'Ithal' : normalizedUser === 'sanu' ? 'Sanu' : null;

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[70vh] px-4 py-8">
      {/* 100% Round Circular Login Card */}
      <div
        style={{
          transform: `rotate(${rotationDegree}deg)`,
          transition: 'transform 0.65s cubic-bezier(0.34, 1.45, 0.7, 1)',
        }}
        className={`w-[330px] h-[330px] sm:w-[370px] sm:h-[370px] rounded-full bg-white text-slate-900 shadow-2xl shadow-black/80 border-4 border-slate-100 flex flex-col items-center justify-center p-6 sm:p-8 text-center relative select-none transition-all duration-300 ${
          isRotating ? 'scale-95 opacity-80' : 'scale-100 opacity-100'
        }`}
      >
        {/* Error Notification */}
        {error && (
          <div className="mb-2 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold rounded-full flex items-center gap-1 animate-fade-in max-w-[280px]">
            <AlertCircle className="w-3 h-3 shrink-0 text-rose-600" />
            <span className="truncate">{error}</span>
          </div>
        )}

        {/* STEP 1: USER NAME (Round letters Bold Black, No Continue Button, Auto-Spins on type) */}
        {step === 'username' ? (
          <div className="w-full max-w-[260px] flex flex-col items-center">
            <label
              htmlFor="round-login-username"
              className="block text-sm sm:text-base font-black text-black tracking-widest uppercase font-display mb-2.5"
            >
              USER NAME
            </label>

            <div className="relative w-full mb-3">
              <input
                id="round-login-username"
                ref={usernameInputRef}
                type="text"
                autoComplete="off"
                placeholder="Enter Ithal or Sanu"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                onKeyDown={handleUsernameKeyDown}
                className="w-full pl-9 pr-4 py-3 bg-slate-50 border-2 border-slate-300 focus:border-black focus:bg-white rounded-full text-black font-black text-center text-sm sm:text-base placeholder:text-slate-400 placeholder:font-normal outline-none transition-all shadow-inner"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            </div>

            <p className="text-[11px] font-bold text-slate-400 tracking-wide font-display">
              Type your name to spin
            </p>
          </div>
        ) : (
          /* STEP 2: PASSWORD (Round letters Bold Black, Auto-submits on Ithal7 / Sanu9) */
          <form
            onSubmit={handlePasswordSubmit}
            className="w-full max-w-[260px] flex flex-col items-center"
          >
            <div className="flex items-center justify-between w-full mb-2 px-2">
              <label
                htmlFor="round-login-password"
                className="text-xs sm:text-sm font-black text-black tracking-widest uppercase font-display"
              >
                PASSWORD
              </label>
              <button
                type="button"
                onClick={triggerClockwiseSpinToUsername}
                className="text-[10px] font-bold text-slate-500 hover:text-black flex items-center gap-0.5 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back</span>
              </button>
            </div>

            <div className="relative w-full mb-3">
              <input
                id="round-login-password"
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className="w-full pl-9 pr-9 py-3 bg-slate-50 border-2 border-slate-300 focus:border-black focus:bg-white rounded-full text-black font-black text-center text-sm sm:text-base placeholder:text-slate-400 placeholder:font-normal outline-none transition-all shadow-inner"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-slate-400 hover:text-black absolute right-3 top-3 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || !password || isRotating}
              className="w-full py-2.5 bg-black hover:bg-slate-800 disabled:opacity-40 text-white font-black text-xs sm:text-sm rounded-full shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer font-display active:scale-95"
            >
              <span>{isLoading ? 'Entering...' : `Play as ${username}`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
