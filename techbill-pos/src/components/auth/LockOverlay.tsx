import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LogOut, KeyRound, AlertCircle, Delete } from 'lucide-react';
import { useLockStore } from '../../store/lock.store';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../api/client';
import { disconnectSocket } from '../../api/socket';

export default function LockOverlay() {
  const { isLocked, isPinSet, verifyPin, unlock, clearPin } = useLockStore();
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const [pin, setPin] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Password reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [password, setPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);


  // Handle number click
  const handleNumClick = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setErrorMsg('');
      
      if (nextPin.length === 4) {
        // Auto verify once 4 digits are entered
        setTimeout(() => {
          if (verifyPin(nextPin)) {
            unlock();
            setPin('');
          } else {
            setIsShaking(true);
            setErrorMsg('Incorrect PIN');
            setPin('');
            setTimeout(() => setIsShaking(false), 500);
          }
        }, 150);
      }
    }
  };

  // Handle backspace
  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  // Keyboard support for PIN entry
  useEffect(() => {
    if (!isLocked || !isPinSet || !user) return;
    // Ignore if password reset modal is open
    if (showResetModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumClick(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        setPin('');
        setErrorMsg('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, showResetModal, isLocked, isPinSet, user]);

  const handleLogout = () => {
    disconnectSocket();
    clearAuth();
    clearPin(); // reset lock status
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost && window.location.hostname !== 'techbill.app' && window.location.hostname !== 'test-techbill.vercel.app') {
      window.location.href = 'https://techbill.app/login?logout=true';
    } else {
      navigate('/login', { replace: true });
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setVerifyingPassword(true);
    setResetError('');

    try {
      const res = await api.post<{ valid: boolean }>('/auth/verify-password', {
        password,
      });

      if (res.data.valid) {
        // Success: Clear the PIN & unlock
        clearPin();
        setShowResetModal(false);
        setPassword('');
        unlock();
      } else {
        setResetError('Incorrect account password. Please try again.');
      }
    } catch (err: any) {
      setResetError(
        err.response?.data?.message || 'Server error. Please try again later.'
      );
    } finally {
      setVerifyingPassword(false);
    }
  };

  // If not locked, PIN is not set, or no user is logged in, don't show the overlay
  if (!isLocked || !isPinSet || !user) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-stitch-surface/90 backdrop-blur-xl overflow-y-auto">
      {/* Shake style definition */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .shake-animation {
          animation: shake 0.35s ease-in-out;
        }
      `}</style>

      <div className="w-full max-w-md p-6 flex flex-col items-center">
        {/* User Card */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-stitch-primary to-stitch-tertiary flex items-center justify-center text-white text-3xl font-bold font-space shadow-lg shadow-stitch-primary/20">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-stitch-surface border-2 border-white/5 p-1.5 rounded-full shadow-md text-stitch-primary">
              <Lock size={16} />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white font-space">
            {user?.name || 'Store Operator'}
          </h2>
          <p className="text-xs text-stitch-on-surface-variant mt-1 uppercase tracking-wider font-mono">
            {user?.tenantName || 'TechBill'} — {user?.role?.replace('_', ' ')}
          </p>
        </div>

        {/* PIN Indicators */}
        <div
          className={`flex gap-4 justify-center items-center h-10 mb-8 ${
            isShaking ? 'shake-animation text-stitch-error' : ''
          }`}
        >
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-150 border-2 ${
                isShaking
                  ? 'bg-stitch-error border-stitch-error'
                  : pin.length > index
                  ? 'bg-stitch-primary border-stitch-primary scale-110 shadow-sm shadow-stitch-primary'
                  : 'bg-transparent border-white/20'
              }`}
            />
          ))}
        </div>

        {errorMsg && (
          <p className="text-xs font-bold text-stitch-error text-center -mt-4 mb-4 flex items-center gap-1 animate-pulse">
            <AlertCircle size={12} /> {errorMsg}
          </p>
        )}

        {/* PIN Pad */}
        <div className="grid grid-cols-3 gap-4 w-64 max-w-xs mb-8">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleNumClick(num)}
              className="w-16 h-16 rounded-full border border-white/5 bg-white/[0.02] hover:bg-white/[0.08] active:bg-white/[0.15] text-xl font-bold text-white transition-all flex items-center justify-center font-space hover:border-white/10"
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => setShowResetModal(true)}
            className="w-16 h-16 rounded-full text-xs font-semibold text-stitch-on-surface-variant hover:text-white transition-colors flex items-center justify-center"
            title="Reset Lock"
          >
            Reset
          </button>
          <button
            onClick={() => handleNumClick('0')}
            className="w-16 h-16 rounded-full border border-white/5 bg-white/[0.02] hover:bg-white/[0.08] active:bg-white/[0.15] text-xl font-bold text-white transition-all flex items-center justify-center font-space hover:border-white/10"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="w-16 h-16 rounded-full border border-white/5 bg-white/[0.02] hover:bg-white/[0.08] active:bg-white/[0.15] text-white transition-all flex items-center justify-center hover:border-white/10 text-stitch-on-surface-variant hover:text-white"
            aria-label="Backspace"
          >
            <Delete size={20} />
          </button>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col items-center gap-3.5 w-full mt-4 border-t border-white/5 pt-5">
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-1.5 text-xs text-stitch-primary hover:text-stitch-primary/80 transition-colors font-semibold"
          >
            <KeyRound size={14} /> Forgot PIN? Reset with password
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-stitch-on-surface-variant hover:text-white transition-colors font-semibold"
          >
            <LogOut size={14} /> Sign out & switch user
          </button>
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="glass-modal w-full max-w-sm rounded-xl p-6 border border-white/10 shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-white font-space mb-2 flex items-center gap-1.5">
              <KeyRound className="text-stitch-primary" size={18} /> Reset App Lock PIN
            </h3>
            <p className="text-xs text-stitch-on-surface-variant leading-relaxed mb-4">
              Enter your account's main login password to clear the App Lock passcode and unlock the system.
            </p>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-stitch-on-surface-variant uppercase tracking-wider mb-1.5">
                  Account Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-stitch-surface-container-high/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-stitch-on-surface outline-none focus:border-stitch-primary/50 transition-colors placeholder:text-stitch-on-surface-variant/50"
                  placeholder="Enter account password"
                  autoFocus
                />
              </div>

              {resetError && (
                <div className="flex gap-2 bg-stitch-error/10 border border-stitch-error/20 p-2.5 rounded-lg text-xs text-stitch-error items-center leading-normal">
                  <AlertCircle size={14} className="shrink-0" />
                  <p>{resetError}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setPassword('');
                    setResetError('');
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-stitch-on-surface-variant hover:text-white transition-colors"
                  disabled={verifyingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-stitch-primary text-white hover:bg-stitch-primary/80 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  disabled={verifyingPassword || !password}
                >
                  {verifyingPassword ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : null}
                  Verify & Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
