import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { can } from '../../lib/permissions';
import { Sun, Moon, ArrowRight, Menu, X } from 'lucide-react';
import { useKeepAlive } from '../../hooks/useKeepAlive';

interface PublicThemeContextType {
  isDark: boolean;
  setIsDark: (val: boolean) => void;
}

const PublicThemeContext = createContext<PublicThemeContextType | undefined>(undefined);

export function usePublicTheme() {
  const context = useContext(PublicThemeContext);
  if (!context) {
    throw new Error('usePublicTheme must be used within a PublicThemeProvider');
  }
  return context;
}

function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let stars: { x: number; y: number; size: number; speed: number; opacity: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = Array.from({ length: 120 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 0.05 + 0.015,
        opacity: Math.random() * 0.5 + 0.1,
      }));
    };

    window.addEventListener('resize', resize);
    resize();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';

      stars.forEach((star) => {
        ctx.save();
        ctx.globalAlpha = star.opacity;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        star.y -= star.speed;
        if (star.y < 0) {
          star.y = canvas.height;
          star.x = Math.random() * canvas.width;
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0 opacity-20 dark:opacity-30 mix-blend-screen"
    />
  );
}

export default function PublicLayout() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Mount the non-blocking Render keep-alive pinger at the root shell level.
  // Fires a silent low-priority fetch every 12 min to mitigate free-tier cold starts.
  useKeepAlive();
  
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('electrotrack_theme');
    if (saved) return saved === 'dark';
    return true; // default dark for tech premium aesthetic
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('electrotrack_theme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }

    return () => {
      // Ensure we restore default dark theme when leaving public pages (e.g. going to POS/Dashboard)
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    };
  }, [isDark]);

  const getDashboardUrl = () => {
    if (!user) return '/login';
    if (user.role === 'platform_admin') return '/tenants';
    if (can('pos.read')) return '/pos';
    if (can('reports.read')) return '/dashboard';
    return '/pos';
  };

  const dashboardUrl = getDashboardUrl();
  const isLoggedIn = !!user;

  const handleNavClick = (sectionId: string) => {
    setMobileMenuOpen(false);
    if (location.pathname !== '/') {
      navigate(`/#${sectionId}`);
      // Wait for navigation then scroll
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <PublicThemeContext.Provider value={{ isDark, setIsDark }}>
      <div className={isDark ? 'dark' : ''}>
        <div className="w-full min-h-screen bg-slate-50 text-slate-900 dark:bg-[#060813] dark:text-[#dee1f7] transition-colors duration-300 font-sans selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-indigo-200 flex flex-col justify-between relative overflow-hidden">
          
          {/* Starfield Animated Background */}
          <Starfield />

          {/* Deep violet and cyan orbital gradient mesh texture at sub-5% opacity */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[50%] bg-violet-600/3 dark:bg-violet-600/4 rounded-full blur-[140px]" />
            <div className="absolute bottom-[20%] right-[-10%] w-[55%] h-[50%] bg-cyan-500/3 dark:bg-cyan-500/4 rounded-full blur-[140px]" />
            <div className="absolute top-[40%] right-[10%] w-[45%] h-[40%] bg-indigo-500/2 dark:bg-indigo-500/3 rounded-full blur-[160px]" />
          </div>

          {/* Header */}
          <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/5 dark:bg-[#0c1020]/40 border-b border-white/10 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              {/* Logo */}
              <Link to="/" className="flex items-center cursor-pointer">
                <img src="/favicon.svg" alt="ElectroTrack Logo" className="h-9 w-auto" />
                <span className="ml-2.5 font-space text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  ElectroTrack<span className="text-[#2fd9f4] font-extrabold">.</span>
                </span>
              </Link>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center space-x-8">
                <button onClick={() => handleNavClick('features')} className="text-sm font-medium text-slate-600 dark:text-[#c7c4d7] hover:text-indigo-600 dark:hover:text-white hover:drop-shadow-[0_0_8px_rgba(139,92,246,0.6)] transition-all">
                  Features
                </button>
                <button onClick={() => handleNavClick('mockup')} className="text-sm font-medium text-slate-600 dark:text-[#c7c4d7] hover:text-indigo-600 dark:hover:text-white hover:drop-shadow-[0_0_8px_rgba(139,92,246,0.6)] transition-all">
                  Interface
                </button>
                <button onClick={() => handleNavClick('pricing')} className="text-sm font-medium text-slate-600 dark:text-[#c7c4d7] hover:text-indigo-600 dark:hover:text-white hover:drop-shadow-[0_0_8px_rgba(139,92,246,0.6)] transition-all">
                  Pricing
                </button>
                <button onClick={() => handleNavClick('architects')} className="text-sm font-medium text-slate-600 dark:text-[#c7c4d7] hover:text-indigo-600 dark:hover:text-white hover:drop-shadow-[0_0_8px_rgba(139,92,246,0.6)] transition-all">
                  Architects
                </button>
              </nav>

              {/* Actions */}
              <div className="hidden md:flex items-center space-x-4">
                {/* Theme Toggle */}
                <button
                  onClick={() => setIsDark(!isDark)}
                  className="p-2 rounded-lg text-slate-500 dark:text-[#c7c4d7] hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                  aria-label="Toggle Theme"
                >
                  {isDark ? <Sun size={18} className="text-[#2fd9f4]" /> : <Moon size={18} className="text-indigo-600" />}
                </button>

                <Link
                  to={dashboardUrl}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-bold rounded-lg transition-all active:scale-[0.98] bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-[#c0c1ff] dark:text-[#1000a9] dark:hover:bg-[#c0c1ff]/90 shadow-md shadow-indigo-600/10 dark:shadow-none"
                >
                  {isLoggedIn ? 'Go to Dashboard' : 'Login Portal'}
                  <ArrowRight size={14} className="ml-1.5" />
                </Link>
              </div>

              {/* Mobile Menu button */}
              <div className="flex items-center space-x-2 md:hidden">
                <button
                  onClick={() => setIsDark(!isDark)}
                  className="p-2 rounded-lg text-slate-500 dark:text-[#c7c4d7] hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                >
                  {isDark ? <Sun size={18} className="text-[#2fd9f4]" /> : <Moon size={18} className="text-indigo-600" />}
                </button>
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 rounded-lg text-slate-500 dark:text-[#c7c4d7] hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                >
                  {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
              </div>
            </div>
          </header>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-slate-200 dark:border-white/5 bg-slate-50/90 dark:bg-[#060813]/95 backdrop-blur-lg px-4 pt-2 pb-4 space-y-2 relative z-50">
              <button onClick={() => handleNavClick('features')} className="block w-full text-left px-3 py-2.5 rounded-lg text-base font-medium text-slate-700 dark:text-[#c7c4d7] hover:bg-slate-100 dark:hover:bg-white/5">
                Features
              </button>
              <button onClick={() => handleNavClick('mockup')} className="block w-full text-left px-3 py-2.5 rounded-lg text-base font-medium text-slate-700 dark:text-[#c7c4d7] hover:bg-slate-100 dark:hover:bg-white/5">
                Interface Mockup
              </button>
              <button onClick={() => handleNavClick('pricing')} className="block w-full text-left px-3 py-2.5 rounded-lg text-base font-medium text-slate-700 dark:text-[#c7c4d7] hover:bg-slate-100 dark:hover:bg-white/5">
                Pricing
              </button>
              <button onClick={() => handleNavClick('architects')} className="block w-full text-left px-3 py-2.5 rounded-lg text-base font-medium text-slate-700 dark:text-[#c7c4d7] hover:bg-slate-100 dark:hover:bg-white/5">
                Architects
              </button>
              <div className="pt-2 border-t border-slate-200 dark:border-white/5">
                <Link
                  to={dashboardUrl}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 text-base font-bold rounded-lg bg-indigo-600 text-white dark:bg-[#c0c1ff] dark:text-[#1000a9] hover:opacity-95"
                >
                  {isLoggedIn ? 'Go to Dashboard' : 'Login Portal'}
                  <ArrowRight size={16} className="ml-2" />
                </Link>
              </div>
            </div>
          )}

          {/* Page Content */}
          <main className="flex-grow relative z-10">
            <Outlet />
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-[#060813]/60 backdrop-blur-md py-12 transition-colors duration-300 relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center">
                <img src="/favicon.svg" alt="ElectroTrack Logo" className="h-6 w-auto" />
                <span className="ml-2 font-space text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  ElectroTrack<span className="text-[#2fd9f4]">.</span>
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-white/30 font-medium text-center md:text-left leading-relaxed">
                &copy; {new Date().getFullYear()} ElectroTrack SaaS. Built with enterprise grade standards by{' '}
                <span className="text-slate-700 dark:text-white/60 font-semibold">TalhaRana</span> &amp;{' '}
                <span className="text-slate-700 dark:text-white/60 font-semibold">KrishBaresha</span>. All rights reserved.
              </p>

              <div className="flex items-center space-x-6 text-xs text-slate-500 dark:text-white/30">
                <Link to="/privacy" className="hover:text-indigo-600 dark:hover:text-white transition-colors">Privacy Policy</Link>
                <Link to="/terms" className="hover:text-indigo-600 dark:hover:text-white transition-colors">Terms of Service</Link>
                <Link to="/security" className="hover:text-indigo-600 dark:hover:text-white transition-colors">Security Requisitions</Link>
              </div>
            </div>
          </footer>

        </div>
      </div>
    </PublicThemeContext.Provider>
  );
}
