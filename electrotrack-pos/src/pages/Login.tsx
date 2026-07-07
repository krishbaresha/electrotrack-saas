import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  const [serverError, setServerError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  // Clear any stale persisted auth state when the login page mounts
  useEffect(() => { clearAuth(); }, [clearAuth]);

  const handleLoginSubmit = async (data: LoginFormData) => {
    setServerError(null);
    setInfoMessage(null);
    try {
      const res = await api.post<{ access_token: string; user: User; refresh_token?: string; subdomain?: string }>('/auth/login', data);
      setAuth(res.data.user, res.data.access_token, res.data.refresh_token);
      connectSocket(res.data.access_token);
      
      if (res.data.user.role === 'platform_admin') {
        const u = encodeURIComponent(btoa(JSON.stringify(res.data.user)));
        window.location.href = `https://admin.techbill.app/tenants?token=${res.data.access_token}&refresh_token=${res.data.refresh_token || ''}&u=${u}`;
      } else {
        const sub = res.data.subdomain || 'app';
        const u = encodeURIComponent(btoa(JSON.stringify(res.data.user)));
        window.location.href = `https://${sub}.techbill.app/dashboard?token=${res.data.access_token}&refresh_token=${res.data.refresh_token || ''}&u=${u}`;
      }
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string | string[] }; status?: number };
        code?: string;
      };
      const status = axiosErr.response?.status;
      const raw = axiosErr.response?.data?.message;
      // NestJS validation errors return message as string[] â€” join them
      const msg = Array.isArray(raw) ? raw.join('. ') : raw;

      if (!axiosErr.response || axiosErr.code === 'ERR_NETWORK') {
        setServerError('Cannot connect to API â€” run: cd techbill-api && npm run start:dev');
      } else if (status === 401) {
        setServerError('Invalid email or password.');
      } else if (status === 403) {
        setServerError('Account suspended. Contact the platform admin.');
      } else if (typeof msg === 'string' && msg.length > 0) {
        setServerError(msg);
      } else {
        setServerError(`Server error (${status ?? 'unknown'}) â€” check the API terminal for details.`);
      }
    }
  };



  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e1322] relative overflow-hidden">
      <div className="absolute top-10 left-10 w-72 h-72 bg-stitch-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-stitch-tertiary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="glass-card rounded-2xl p-8 w-full max-w-sm relative z-10 border border-white/10">
        <div className="mb-6 text-center flex flex-col items-center">
          <img src="/logo.svg" alt="TechBill Logo" className="h-14 w-auto mb-2" />
          <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">SaaS Multi-tenant Enterprise Management</p>
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

        <div className="mb-6 p-3 bg-white/5 border border-white/10 rounded-lg backdrop-blur-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-stitch-primary/10 to-transparent pointer-events-none" />
          <p className="text-[10px] text-white/50 leading-relaxed relative z-10">
            For security and fraud prevention, self-service password recovery is disabled. Please contact your store administrator or TechBill support directly to reset your credentials.
          </p>
        </div>

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
              </div>
              <div className="relative">
                <input {...register('password')} type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" className={`${inputCls} pr-10`} />
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
                <><span className="w-4 h-4 border-2 border-stitch-on-primary/30 border-t-stitch-on-primary rounded-full animate-spin" /> Signing inâ€¦</>
              ) : 'Sign in to Terminal'}
            </button>
          </form>
      </div>
    </div>
  );
}
