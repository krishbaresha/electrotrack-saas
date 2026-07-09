import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth.store';
import { connectSocket } from '../api/socket';
import type { User } from '../types';
import gsap from 'gsap';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const inputCls = 'w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-11 pr-4 py-3 text-[13px] text-white placeholder-white/30 outline-none focus:bg-white/[0.06] focus:border-stitch-primary/50 focus:ring-1 focus:ring-stitch-primary/30 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] backdrop-blur-md';
const labelCls = 'block text-[11px] font-bold text-white/60 mb-1.5 ml-1 uppercase tracking-wider';

export default function Login() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  // Clear any stale persisted auth state when the login page mounts
  useEffect(() => { clearAuth(); }, [clearAuth]);

  // Background ping to wake up the Render API (Cold Start Prevention)
  useEffect(() => {
    api.get('/health').catch(() => {
      // Silently ignore errors. The goal is just to trigger a network request to wake the instance.
    });
  }, []);

  // GSAP Animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Background glow animation
      gsap.fromTo('.bg-glow',
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 0.5, duration: 2.5, ease: 'power3.out' }
      );

      // Main timeline for the login components
      const tl = gsap.timeline();

      tl.fromTo(logoRef.current,
        { y: -30, opacity: 0, scale: 0.9 },
        { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(1.5)' }
      )
      .fromTo('.heading-text',
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'power2.out' },
        '-=0.4'
      )
      .fromTo(cardRef.current,
        { y: 30, opacity: 0, rotationX: -5 },
        { y: 0, opacity: 1, rotationX: 0, duration: 0.8, ease: 'power3.out', transformPerspective: 1000 },
        '-=0.3'
      )
      .fromTo('.form-item',
        { x: -20, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'power2.out' },
        '-=0.5'
      )
      .fromTo('.footer-link',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 },
        '-=0.2'
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const handleLoginSubmit = async (data: LoginFormData) => {
    setServerError(null);
    setInfoMessage(null);
    try {
      const res = await api.post<{ access_token: string; user: User; refresh_token?: string; subdomain?: string }>('/auth/login', data);
      setAuth(res.data.user, res.data.access_token, res.data.refresh_token);
      connectSocket(res.data.access_token);
      
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const u = encodeURIComponent(btoa(JSON.stringify(res.data.user)));

      if (res.data.user.role === 'platform_admin') {
        if (isLocalhost) {
          window.location.href = `/tenants?token=${res.data.access_token}&refresh_token=${res.data.refresh_token || ''}&u=${u}`;
        } else {
          window.location.href = `https://admin.techbill.app/tenants?token=${res.data.access_token}&refresh_token=${res.data.refresh_token || ''}&u=${u}`;
        }
      } else {
        const sub = res.data.subdomain || 'app';
        if (isLocalhost) {
          window.location.href = `/dashboard?token=${res.data.access_token}&refresh_token=${res.data.refresh_token || ''}&u=${u}`;
        } else {
          window.location.href = `https://${sub}.techbill.app/dashboard?token=${res.data.access_token}&refresh_token=${res.data.refresh_token || ''}&u=${u}`;
        }
      }
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
        setServerError('Cannot connect to API — run: cd techbill-api && npm run start:dev');
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

  return (
    <div ref={containerRef} className="min-h-screen flex items-center justify-center bg-[#07080d] relative overflow-hidden font-sans">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(65,105,225,0.08),transparent_60%)] pointer-events-none" />
      <div className="bg-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-stitch-primary/10 rounded-full blur-[140px] pointer-events-none opacity-0" />
      
      {/* Decorative Grid */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_20%,transparent_100%)] pointer-events-none" />

      <div className="w-full max-w-[440px] px-6 relative z-10">
        
        {/* Logo Container */}
        <div ref={logoRef} className="flex flex-col items-center mb-10 opacity-0">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl mb-5 relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-stitch-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl blur-xl" />
            <img src="/logo.svg" alt="TechBill Logo" className="h-12 w-auto relative z-10" />
          </div>
          <h1 className="heading-text text-2xl font-bold text-white tracking-tight opacity-0">Welcome Back</h1>
          <p className="heading-text text-[12px] text-white/50 mt-2 font-semibold tracking-[0.2em] uppercase opacity-0">SaaS Multi-tenant Enterprise</p>
        </div>

        {/* Main Card */}
        <div ref={cardRef} className="bg-white/[0.02] backdrop-blur-2xl rounded-[2rem] p-8 sm:p-10 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden opacity-0">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-stitch-primary/50 to-transparent" />
          
          {serverError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-[13px] text-red-200 leading-relaxed">{serverError}</p>
            </div>
          )}
          {infoMessage && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
              <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[13px] text-emerald-200 leading-relaxed">{infoMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(handleLoginSubmit)} className="space-y-6">
            <div className="form-item opacity-0">
              <label className={labelCls}>Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40 group-focus-within:text-stitch-primary transition-colors">
                  <Mail size={16} strokeWidth={2.5} />
                </div>
                <input {...register('email')} type="email" autoComplete="email"
                  placeholder="admin@techbill.app" className={inputCls} />
              </div>
              {errors.email && <p className="text-xs text-red-400 mt-1.5 ml-1">{errors.email.message}</p>}
            </div>

            <div className="form-item opacity-0">
              <label className={labelCls}>Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40 group-focus-within:text-stitch-primary transition-colors">
                  <Lock size={16} strokeWidth={2.5} />
                </div>
                <input {...register('password')} type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  placeholder="••••••••" className={inputCls} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-white/30 hover:text-white/80 hover:bg-white/5 rounded-lg transition-all">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400 mt-1.5 ml-1">{errors.password.message}</p>}
            </div>

            <div className="form-item opacity-0 pt-2">
              <button type="submit" disabled={isSubmitting}
                className="w-full relative group overflow-hidden bg-white text-black font-bold rounded-xl py-4 text-sm transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)]">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                {isSubmitting ? (
                  <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Authenticating...</>
                ) : (
                  <>Sign In to Terminal <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </div>
          </form>
          
          <div className="form-item opacity-0 mt-8 pt-6 border-t border-white/5 flex items-start gap-3">
             <div className="p-2 bg-stitch-primary/10 rounded-lg shrink-0 mt-0.5 border border-stitch-primary/20">
               <ShieldCheck size={16} className="text-stitch-primary" />
             </div>
             <p className="text-[11px] text-white/40 leading-relaxed font-medium">
              For security and fraud prevention, self-service password recovery is disabled. Contact your administrator.
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center flex items-center justify-center gap-4 text-[11px] text-white/40 font-medium">
          <Link to="/privacy" className="footer-link opacity-0 hover:text-white transition-colors">Privacy Policy</Link>
          <span className="footer-link opacity-0 w-1 h-1 bg-white/20 rounded-full" />
          <Link to="/terms" className="footer-link opacity-0 hover:text-white transition-colors">Terms of Service</Link>
          <span className="footer-link opacity-0 w-1 h-1 bg-white/20 rounded-full" />
          <a href="mailto:krishbaresha@gmail.com" className="footer-link opacity-0 hover:text-white transition-colors">Support</a>
        </div>
      </div>
    </div>
  );
}

