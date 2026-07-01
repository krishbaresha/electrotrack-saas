import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth.store';
import { connectSocket } from '../api/socket';
import type { User } from '../types';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-stitch-primary/50 transition-all';
const labelCls = 'block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [serverError, setServerError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  // Clear any stale persisted auth state when the login page mounts
  useEffect(() => { clearAuth(); }, [clearAuth]);

  const handleLoginSubmit = async (data: LoginFormData) => {
    setServerError(null);
    setInfoMessage(null);
    try {
      const res = await api.post<{ access_token: string; user: User; refresh_token?: string }>('/auth/login', data);
      setAuth(res.data.user, res.data.access_token, res.data.refresh_token);
      connectSocket(res.data.access_token);
      const dest =
        res.data.user.role === 'platform_admin' ? '/tenants'
        : res.data.user.role === 'owner' || res.data.user.role === 'accountant' ? '/dashboard'
        : '/pos';
      navigate(dest, { replace: true });
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string | string[] }; status?: number };
        code?: string;
      };
      const status = axiosErr.response?.status;
      const raw = axiosErr.response?.data?.message;
      // NestJS validation errors return message as string[] — join them
      const msg = Array.isArray(raw) ? raw.join('. ') : raw;

      if (!axiosErr.response || axiosErr.code === 'ERR_NETWORK') {
        setServerError('Cannot connect to API — run: cd electrotrack-api && npm run start:dev');
      } else if (status === 401) {
        setServerError('Invalid email or password.');
      } else if (status === 403) {
        setServerError('Account suspended. Contact the platform admin.');
      } else if (typeof msg === 'string' && msg.length > 0) {
        setServerError(msg);
      } else {
        setServerError(`Server error (${status ?? 'unknown'}) — check the API terminal for details.`);
      }
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setServerError(null);
    setLoading(true);
    try {
      await api.post('/auth/password-reset/request', { email: resetEmail });
      setInfoMessage('If this account is eligible for self-reset, a 6-digit OTP has been sent to your email.');
      setMode('reset');
    } catch {
      setServerError('Failed to request reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !newPassword) return;
    setServerError(null);
    setLoading(true);
    try {
      await api.post('/auth/password-reset/confirm', { email: resetEmail, otp, newPassword });
      setInfoMessage('Password updated. You can now sign in with your new credentials.');
      setMode('login');
      setResetEmail('');
      setOtp('');
      setNewPassword('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setServerError(e.response?.data?.message ?? 'Incorrect OTP or expired token. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const goLogin = () => { setMode('login'); setServerError(null); setInfoMessage(null); };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e1322] relative overflow-hidden">
      <div className="absolute top-10 left-10 w-72 h-72 bg-stitch-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-stitch-tertiary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="glass-card rounded-2xl p-8 w-full max-w-sm relative z-10 border border-white/10">
        <div className="mb-7 text-center">
          <div className="w-12 h-12 bg-stitch-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3 border border-stitch-primary/20">
            <span className="text-xl font-black text-stitch-primary font-space">ET</span>
          </div>
          <h1 className="text-xl font-bold text-white font-space">ElectroTrack POS</h1>
          <p className="text-[11px] text-white/40 mt-1">SaaS Multi-tenant Enterprise Management</p>
        </div>

        {serverError && (
          <div className="mb-4 p-3 bg-stitch-error/10 border border-stitch-error/30 rounded-lg flex items-center gap-2">
            <AlertTriangle size={13} className="text-stitch-error shrink-0" />
            <p className="text-xs text-stitch-error font-medium">{serverError}</p>
          </div>
        )}
        {infoMessage && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-xs text-green-400 font-medium">{infoMessage}</p>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleSubmit(handleLoginSubmit)} className="space-y-4">
            <div>
              <label className={labelCls}>Email address</label>
              <input {...register('email')} type="email" autoComplete="email"
                placeholder="you@shop.com" className={inputCls} />
              {errors.email && <p className="text-[11px] text-stitch-error mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className={labelCls}>Password</label>
                <button type="button"
                  onClick={() => { setMode('forgot'); setServerError(null); setInfoMessage(null); }}
                  className="text-[11px] text-stitch-primary hover:text-stitch-primary/80 font-medium transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input {...register('password')} type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  placeholder="••••••••" className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors flex items-center justify-center">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-[11px] text-stitch-error mt-1">{errors.password.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting}
              className="w-full bg-stitch-primary hover:bg-stitch-primary/90 text-stitch-on-primary font-bold rounded-lg py-2.5 text-sm transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
              {isSubmitting ? (
                <><span className="w-4 h-4 border-2 border-stitch-on-primary/30 border-t-stitch-on-primary rounded-full animate-spin" /> Signing in…</>
              ) : 'Sign in to Terminal'}
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <h2 className="text-sm font-bold text-white font-space">Forgot Password</h2>
            <p className="text-[11px] text-white/50 leading-normal">
              Enter your email to request a secure OTP reset.
            </p>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-[10px] text-amber-400 leading-normal">
                <strong>Workers:</strong> Only Owners and platform admins can self-reset. Standard staff must contact their shop owner.
              </p>
            </div>
            <div>
              <label className={labelCls}>Registered Email</label>
              <input type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@shop.com" className={inputCls} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-stitch-primary hover:bg-stitch-primary/90 text-stitch-on-primary font-bold rounded-lg py-2.5 text-sm transition-all disabled:opacity-50">
              {loading ? 'Sending OTP…' : 'Send Reset Code'}
            </button>
            <button type="button" onClick={goLogin}
              className="w-full text-center text-[11px] text-white/40 hover:text-white transition-colors pt-1">
              Back to Sign in
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <h2 className="text-sm font-bold text-white font-space">Verify OTP & Reset</h2>
            <div>
              <label className={labelCls}>6-Digit OTP Code</label>
              <input type="text" required maxLength={6} value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="123456"
                className={`${inputCls} text-center tracking-[0.5em] font-mono text-lg`} />
            </div>
            <div>
              <label className={labelCls}>New Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} required minLength={8} value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters" className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors flex items-center justify-center">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading || otp.length !== 6 || newPassword.length < 8}
              className="w-full bg-stitch-primary hover:bg-stitch-primary/90 text-stitch-on-primary font-bold rounded-lg py-2.5 text-sm transition-all disabled:opacity-50">
              {loading ? 'Verifying…' : 'Update Credentials'}
            </button>
            <button type="button" onClick={goLogin}
              className="w-full text-center text-[11px] text-white/40 hover:text-white transition-colors pt-1">
              Cancel and Return
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
