import os

content = """import { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence, useMotionTemplate } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePublicTheme } from '../components/layout/PublicLayout';
import { 
  BarChart3, ShoppingCart, FileText, Globe, 
  Check, ArrowRight, Zap, Linkedin, 
  ChevronRight, Activity, AlertCircle, CheckCircle2, Network, X
} from 'lucide-react';

function BentoCard({ children, className, variants }: { children: React.ReactNode, className?: string, variants?: any }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <motion.div
      variants={variants}
      onMouseMove={handleMouseMove}
      whileHover={{ y: -6, transition: { duration: 0.3, ease: "easeOut" } }}
      className={`group relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-xl p-8 transition-colors duration-300 flex flex-col justify-between min-h-[300px] shadow-sm hover:shadow-md dark:shadow-none ${className}`}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-350"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              300px circle at ${mouseX}px ${mouseY}px,
              rgba(139, 92, 246, 0.12) 0%,
              rgba(6, 182, 212, 0.08) 50%,
              transparent 100%
            )
          `,
        }}
      />
      <div className="relative z-10 flex flex-col justify-between h-full flex-1">
        {children}
      </div>
    </motion.div>
  );
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

type CurrencyCode = 'USD' | 'PKR' | 'EUR' | 'GBP';

interface CurrencyDetails {
  symbol: string;
  starterPrice: { monthly: number; annual: number };
  proPrice: { monthly: number; annual: number };
  label: string;
}

const currencies: Record<CurrencyCode, CurrencyDetails> = {
  USD: {
    symbol: '$',
    starterPrice: { monthly: 49, annual: 39 },
    proPrice: { monthly: 99, annual: 79 },
    label: 'US / Global (USD)',
  },
  PKR: {
    symbol: '₨',
    starterPrice: { monthly: 13900, annual: 11100 },
    proPrice: { monthly: 27900, annual: 22300 },
    label: 'Pakistan (PKR)',
  },
  EUR: {
    symbol: '€',
    starterPrice: { monthly: 46, annual: 37 },
    proPrice: { monthly: 92, annual: 74 },
    label: 'Europe (EUR)',
  },
  GBP: {
    symbol: '£',
    starterPrice: { monthly: 39, annual: 31 },
    proPrice: { monthly: 79, annual: 63 },
    label: 'United Kingdom (GBP)',
  },
};

const detectCurrency = (): CurrencyCode => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes('Karachi') || tz.includes('Asia/Karachi')) return 'PKR';
    if (tz.includes('London') || tz.includes('Europe/London')) return 'GBP';
    if (tz.includes('Europe') || tz.includes('Paris') || tz.includes('Berlin') || tz.includes('Rome')) return 'EUR';
  } catch (e) {
    console.error('Failed to detect location timezone', e);
  }
  return 'USD';
};

export default function LandingPage() {
  usePublicTheme();
  const navigate = useNavigate();
  
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');
  const [currency, setCurrency] = useState<CurrencyCode>(() => detectCurrency());
  const [currencySelectorOpen, setCurrencySelectorOpen] = useState(false);

  const [mockupTab, setMockupTab] = useState<'analytics' | 'pos' | 'sync'>('analytics');

  const handleFeatureLinkClick = (tab: 'analytics' | 'pos' | 'sync') => {
    setMockupTab(tab);
    const element = document.getElementById('mockup');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  const [telemetryFilter, setTelemetryFilter] = useState<'all' | 'critical' | 'active'>('all');
  const [liveThroughput, setLiveThroughput] = useState(148);
  const [pulseState, setPulseState] = useState(true);

  const [posCart, setPosCart] = useState<CartItem[]>([]);
  const [posSuccess, setPosSuccess] = useState(false);

  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);

  const rotateX = useTransform(tiltY, [-0.5, 0.5], [6, -6]);
  const rotateY = useTransform(tiltX, [-0.5, 0.5], [-6, 6]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    tiltX.set(x);
    tiltY.set(y);
  };

  const handleMouseLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveThroughput(prev => {
        const delta = Math.floor(Math.random() * 21) - 10;
        const next = prev + delta;
        return next < 80 ? 80 : next > 250 ? 250 : next;
      });
      setPulseState(prev => !prev);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const mockProducts = [
    { id: '1', name: 'RTX 4090 GPU', price: 1599 },
    { id: '2', name: 'Ryzen 9 7950X', price: 549 },
    { id: '3', name: 'DDR5 32GB RAM', price: 129 },
  ];

  const addToCart = (product: typeof mockProducts[0]) => {
    setPosCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setPosCart(prev => prev.filter(item => item.id !== id));
  };

  const checkoutCart = () => {
    if (posCart.length === 0) return;
    setPosSuccess(true);
    setTimeout(() => {
      setPosSuccess(false);
      setPosCart([]);
    }, 2500);
  };

  const getSubtotal = () => posCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const getTax = () => Math.round(getSubtotal() * 0.08);
  const getTotal = () => getSubtotal() + getTax();

  const currencyInfo = currencies[currency];
  const starterPrice = billingPeriod === 'annual' ? currencyInfo.starterPrice.annual : currencyInfo.starterPrice.monthly;
  const proPrice = billingPeriod === 'annual' ? currencyInfo.proPrice.annual : currencyInfo.proPrice.monthly;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring' as const, stiffness: 100, damping: 15 }
    }
  };

  return (
    <div className="relative overflow-hidden bg-white dark:bg-zinc-950 transition-colors duration-300 ease-in-out min-h-screen">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] bg-blue-500/10 dark:bg-indigo-500/20 rounded-full blur-[140px]" />
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[60%] bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 lg:pt-32 lg:pb-28 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          {/* Animated Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-50 dark:bg-[#c0c1ff]/10 text-blue-700 dark:text-[#c0c1ff] text-xs font-semibold uppercase tracking-wider mb-8 border border-blue-200 dark:border-[#c0c1ff]/20 shadow-sm transition-colors duration-300"
          >
            <Zap size={14} className="text-blue-500 dark:text-[#2fd9f4] animate-pulse" />
            SaaS Multi-tenant Enterprise Management
          </motion.div>

          {/* Typography Reveal */}
          <motion.h1
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] max-w-5xl mx-auto text-zinc-900 dark:text-white transition-colors duration-300"
          >
            Industrial-Grade OS for{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 dark:from-[#c0c1ff] dark:via-indigo-400 dark:to-[#2fd9f4] bg-clip-text text-transparent">
              Modern Electronics Retail
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed transition-colors duration-300"
          >
            Empower your multi-location enterprise with lightning-fast POS checkout, automated stock provisioning, real-time telemetry analytics, and offline-resilient local syncing.
          </motion.p>

          {/* Magnetic CTA Controls */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto sm:max-w-none"
          >
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/checkout?plan=pro&billing=${billingPeriod}`)}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-bold rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all shadow-xl shadow-zinc-900/20 dark:shadow-none"
            >
              Get Started Now
              <ArrowRight size={16} className="ml-2" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                const element = document.getElementById('mockup');
                if (element) element.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-bold rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-white hover:bg-zinc-50 dark:hover:bg-white/5 transition-all bg-white/50 dark:bg-transparent backdrop-blur-sm"
            >
              Watch System Demo
            </motion.button>
          </motion.div>

        </div>
      </section>

      {/* Interactive 3D Demo Component Section */}
      <section id="mockup" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-28 relative z-20">
        <motion.div
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            rotateX: rotateX,
            rotateY: rotateY,
            transformStyle: 'preserve-3d',
            perspective: 1200,
          }}
          className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 backdrop-blur-xl p-4 sm:p-6 lg:p-8 shadow-2xl transition-all duration-300 hover:shadow-blue-500/10 dark:hover:shadow-indigo-500/10"
        >
          {/* Mockup Terminal Top Header bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-6 gap-3 transition-colors duration-300">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium ml-3 font-mono">
                techbill_live_terminal_v2.0.sh
              </span>
              <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full animate-pulse ml-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                LIVE SYSTEM FEED
              </span>
            </div>
            
            {/* Tab Swappers */}
            <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800/50 p-1 rounded-lg self-start sm:self-auto border border-zinc-200/50 dark:border-white/5 backdrop-blur-md transition-colors duration-300">
              <button
                onClick={() => setMockupTab('analytics')}
                className={`px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-semibold tracking-wide transition-all ${
                  mockupTab === 'analytics'
                    ? 'bg-white text-zinc-900 dark:bg-zinc-700 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-600'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Telemetry Dashboard
              </button>
              <button
                onClick={() => setMockupTab('pos')}
                className={`px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-semibold tracking-wide transition-all ${
                  mockupTab === 'pos'
                    ? 'bg-white text-zinc-900 dark:bg-zinc-700 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-600'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                POS Sandbox
              </button>
              <button
                onClick={() => setMockupTab('sync')}
                className={`px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-semibold tracking-wide transition-all ${
                  mockupTab === 'sync'
                    ? 'bg-white text-zinc-900 dark:bg-zinc-700 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-600'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Multi-Store Sync
              </button>
            </div>
          </div>

          {/* TAB CONTENT: ANALYTICS */}
          {mockupTab === 'analytics' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              {/* Stats Cards */}
              <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 transition-colors duration-300">
                    <div className="flex justify-between items-start text-[10px] font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
                      <span>LIVE TRANSACTION THROUGHPUT</span>
                      <span className="text-emerald-500 font-semibold flex items-center gap-1">
                        <Activity size={10} className="animate-pulse" />
                        STABLE
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-bold text-zinc-900 dark:text-white transition-colors duration-300">
                        {liveThroughput} req/s
                      </span>
                    </div>
                    
                    {/* Live Waveform SVG Data Stream */}
                    <div className="h-12 mt-4 relative overflow-hidden drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] dark:drop-shadow-[0_0_8px_rgba(128,131,255,0.6)]">
                      <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                        <motion.path
                          animate={{
                            d: pulseState 
                              ? "M0,15 Q15,5 30,12 T60,5 T90,15 T100,10"
                              : "M0,10 Q20,15 40,8 T70,12 T90,5 T100,15"
                          }}
                          transition={{ duration: 1.4, ease: "easeInOut" }}
                          fill="none"
                          stroke="currentColor"
                          className="text-blue-500 dark:text-indigo-400 transition-colors duration-300"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 transition-colors duration-300">
                    <div className="flex justify-between items-start text-[10px] font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
                      <span>REGIONAL TERMINALS SYNC</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-extrabold uppercase">
                        ACTIVE
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-4">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 dark:bg-indigo-600 flex items-center justify-center text-[10px] text-white font-bold border-2 border-white dark:border-zinc-900 transition-colors duration-300">TR</div>
                        <div className="w-8 h-8 rounded-full bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center text-[10px] text-white font-bold border-2 border-white dark:border-zinc-900 transition-colors duration-300">KB</div>
                        <div className="w-8 h-8 rounded-full bg-indigo-500 dark:bg-purple-600 flex items-center justify-center text-[10px] text-white font-bold border-2 border-white dark:border-zinc-900 transition-colors duration-300">+8</div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-800 dark:text-white transition-colors duration-300">10 Nodes Connected</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 transition-colors duration-300">Local Latency: 12ms</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Visualization Data Graph */}
                <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 transition-colors duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        NODE TELEMETRY VIEWPORT
                      </p>
                      <h4 className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                        Interactive graph toggles based on filter state
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 bg-zinc-200/50 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors duration-300">
                      {(['all', 'active', 'critical'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setTelemetryFilter(f)}
                          className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
                            telemetryFilter === f
                              ? 'bg-white text-zinc-900 dark:bg-zinc-600 dark:text-white shadow-sm'
                              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-40 flex items-end justify-between gap-3 pt-2">
                    {[
                      { node: 'Node-01', val: 78, status: 'active' },
                      { node: 'Node-02', val: 92, status: 'active' },
                      { node: 'Node-03', val: 34, status: 'critical' },
                      { node: 'Node-04', val: 65, status: 'active' },
                      { node: 'Node-05', val: 12, status: 'critical' },
                      { node: 'Node-06', val: 89, status: 'active' },
                      { node: 'Node-07', val: 55, status: 'active' },
                    ].map((item, idx) => {
                      const isVisible =
                        telemetryFilter === 'all' ||
                        (telemetryFilter === 'active' && item.status === 'active') ||
                        (telemetryFilter === 'critical' && item.status === 'critical');
                      
                      const heightPercent = isVisible ? item.val : 5;
                      const colColor = item.status === 'critical' 
                        ? 'from-red-400 to-rose-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' 
                        : 'from-blue-400 to-emerald-400 dark:from-indigo-500 dark:to-cyan-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)] dark:drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]';

                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                          <motion.div
                            animate={{ height: `${heightPercent}%` }}
                            transition={{ type: 'spring', stiffness: 80, damping: 12 }}
                            className={`w-full rounded-t-md bg-gradient-to-t ${colColor} shadow-md opacity-85 hover:opacity-100 transition-all`}
                          />
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-semibold font-mono tracking-tighter transition-colors duration-300">
                            {item.node}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Side Real-Time Requisitions Feed */}
              <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between transition-colors duration-300">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-700 mb-4 transition-colors duration-300">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      REORDER DISPATCH FEED
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  </div>
                  
                  <div className="space-y-3">
                    {[
                      { item: 'iPhone 15 Pro Max', time: '2m ago', qty: 15 },
                      { item: 'Sony WH-1000XM5 ANC', time: '14m ago', qty: 8 },
                      { item: 'Galaxy S24 Ultra 5G', time: '1h ago', qty: 20 },
                    ].map((entry, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-white dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700 transition-colors duration-300 shadow-sm">
                        <div className="flex justify-between items-start">
                          <p className="text-xs font-bold text-zinc-800 dark:text-white transition-colors duration-300">{entry.item}</p>
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono transition-colors duration-300">{entry.time}</span>
                        </div>
                        <p className="text-[10px] text-blue-600 dark:text-indigo-400 font-semibold mt-1 transition-colors duration-300">
                          Auto-restock Order: +{entry.qty} units
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700 mt-4 transition-colors duration-300">
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed flex items-start gap-1.5 transition-colors duration-300">
                    <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    Central warehouse automatically processed 3 supply orders to prevent checkout stockouts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: POS SANDBOX */}
          {mockupTab === 'pos' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800 transition-colors duration-300">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Boutique Register Catalog
                  </span>
                  <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-indigo-500/10 dark:text-indigo-400 px-2.5 py-0.5 rounded font-mono transition-colors duration-300">
                    REG-041-DT
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {mockProducts.map((prod) => (
                    <div key={prod.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between h-36 hover:border-blue-300 dark:hover:border-indigo-500/30 transition-colors shadow-sm">
                      <div>
                        <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                          COMP-SYSTEM
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-white mt-1">
                          {prod.name}
                        </h4>
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <span className="font-mono text-xs sm:text-sm font-bold text-blue-600 dark:text-indigo-400">
                          ${prod.price}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => addToCart(prod)}
                          className="bg-blue-600 hover:bg-blue-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 px-3 py-1.5 rounded-lg text-white font-bold text-[10px] sm:text-xs transition-colors"
                        >
                          + Cart
                        </motion.button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/20 transition-colors duration-300">
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center">
                    💡 Click <strong>"+ Cart"</strong> on the catalog cards above to instantly feed the sandbox checkout receipt on the right.
                  </p>
                </div>
              </div>

              {/* POS Cart Sidebar */}
              <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between min-h-[300px] transition-colors duration-300 shadow-sm">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pb-3 border-b border-zinc-200 dark:border-zinc-700 transition-colors duration-300">
                    RECEIPT SUMMARY
                  </h3>

                  {posSuccess ? (
                    <div className="py-12 text-center animate-pulse">
                      <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2" />
                      <p className="text-xs font-bold text-emerald-500">PAYMENT APPROVED</p>
                      <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono mt-1 transition-colors duration-300">
                        Invoice sync dispatched.
                      </p>
                    </div>
                  ) : posCart.length === 0 ? (
                    <div className="py-16 text-center text-zinc-400 dark:text-zinc-600 transition-colors duration-300">
                      <ShoppingCart size={24} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-medium">Cart is empty</p>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {posCart.map((item) => (
                        <div key={item.id} className="flex justify-between items-center text-[11px] p-2 rounded bg-white dark:bg-zinc-800/50 shadow-sm border border-zinc-100 dark:border-transparent transition-colors duration-300">
                          <div>
                            <p className="font-bold text-zinc-800 dark:text-white">{item.name}</p>
                            <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">
                              ${item.price} x {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-zinc-800 dark:text-white">
                              ${item.price * item.quantity}
                            </span>
                            <button onClick={() => removeFromCart(item.id)} className="text-rose-500 hover:text-rose-600 p-0.5">
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {!posSuccess && posCart.length > 0 && (
                  <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700 mt-4 space-y-1.5 transition-colors duration-300">
                    <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                      <span>Subtotal</span>
                      <span className="font-mono">${getSubtotal()}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                      <span>Sales Tax (8%)</span>
                      <span className="font-mono">${getTax()}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-zinc-900 dark:text-white pt-1 border-t border-dashed border-zinc-200 dark:border-zinc-700 transition-colors duration-300">
                      <span>Total Due</span>
                      <span className="font-mono text-blue-600 dark:text-indigo-400">${getTotal()}</span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={checkoutCart}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] py-2.5 rounded-lg transition-colors mt-3"
                    >
                      Charge & Print Invoice
                    </motion.button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT: MULTI-STORE SYNC */}
          {mockupTab === 'sync' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              <div className="lg:col-span-2 p-5 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between min-h-[300px] transition-colors duration-300">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pb-3 border-b border-zinc-200 dark:border-zinc-700 transition-colors duration-300">
                    Distributed Sync Network
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                    {[
                      { node: 'Downtown Register', status: 'Online', desc: 'DT-01 • 12ms', color: 'bg-emerald-500' },
                      { node: 'Uptown Boutique', status: 'Online', desc: 'UT-02 • 24ms', color: 'bg-emerald-500' },
                      { node: 'Warehouse Depot', status: 'Online', desc: 'WH-09 • 110ms', color: 'bg-blue-500 dark:bg-indigo-500' },
                    ].map((node, i) => (
                      <div key={i} className="p-4 rounded-xl bg-white dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700 flex flex-col justify-between shadow-sm transition-colors duration-300">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold font-mono transition-colors duration-300">
                            {node.desc}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${node.color} animate-pulse`} />
                        </div>
                        <div className="mt-4">
                          <h4 className="text-xs font-bold text-zinc-800 dark:text-white transition-colors duration-300">{node.node}</h4>
                          <p className="text-[9px] text-emerald-500 font-extrabold uppercase mt-1">
                            {node.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 dark:bg-indigo-500/10 dark:border-indigo-500/20 mt-6 flex gap-2.5 transition-colors duration-300">
                  <Network size={18} className="text-blue-500 dark:text-indigo-400 shrink-0 mt-0.5 transition-colors duration-300" />
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed transition-colors duration-300">
                    TechBill is completely decentralized. In-store registers sync transactions to localized browser IndexedDB layers when internet access drops, automatically batch-reconciling upon gateway reconnection.
                  </p>
                </div>
              </div>

              {/* Sync events list */}
              <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between transition-colors duration-300">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pb-3 border-b border-zinc-200 dark:border-zinc-700 transition-colors duration-300">
                    Sync Event Log
                  </h3>
                  <div className="space-y-3 mt-4 text-[10px] font-mono leading-relaxed text-zinc-500 dark:text-zinc-400 transition-colors duration-300">
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-500">[OK]</span>
                      <span>Boutique DT-01 pushed sales batch #S-1481</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-500">[OK]</span>
                      <span>Stock levels updated for Ryzen 9 7950X</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-blue-500 dark:text-indigo-400">[SYNC]</span>
                      <span>Verified cash drawer reconciliation report</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-blue-500 dark:text-indigo-400">[SYNC]</span>
                      <span>Employee activity logs synced from register WH-09</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-between text-[9px] text-zinc-400 dark:text-zinc-500 font-mono transition-colors duration-300">
                  <span>Channel: WebSockets</span>
                  <span>Queue: Empty</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </section>

      {/* Features Bento Grid Section */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-zinc-200 dark:border-white/5 transition-colors duration-300">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white transition-colors duration-300">
            Built to Power High-Volume Retail
          </h2>
          <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 leading-relaxed transition-colors duration-300">
            Industrial-grade features designed from the ground up for high-scale enterprise hardware environments and fast-paced boutique electronics checkouts.
          </p>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <BentoCard variants={itemVariants} className="md:col-span-2">
            <div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-indigo-500/10 text-blue-600 dark:text-indigo-400 flex items-center justify-center mb-6 transition-colors duration-300 border border-blue-100 dark:border-transparent">
                <BarChart3 size={20} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white transition-colors duration-300">Real-Time Telemetry Analytics</h3>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed transition-colors duration-300">
                Deep intelligence reports mapping purchase velocity, product margins, employee sales throughput, and seasonal turnover. Stream metrics dynamically without database bottlenecking.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleFeatureLinkClick('analytics')}
              className="mt-6 flex items-center text-xs font-bold text-blue-600 dark:text-indigo-400 gap-1 group-hover:gap-2 hover:gap-2 transition-all cursor-pointer text-left self-start"
            >
              Learn more about analytics <ChevronRight size={14} />
            </button>
          </BentoCard>

          <BentoCard variants={itemVariants}>
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-6 transition-colors duration-300 border border-emerald-100 dark:border-transparent">
                <ShoppingCart size={20} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white transition-colors duration-300">Inventory & POS</h3>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed transition-colors duration-300">
                Offline-capable barcode sales processing, automated purchase orders, and stock reordering pipelines.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleFeatureLinkClick('pos')}
              className="mt-6 flex items-center text-xs font-bold text-blue-600 dark:text-indigo-400 gap-1 group-hover:gap-2 hover:gap-2 transition-all cursor-pointer text-left self-start"
            >
              POS details <ChevronRight size={14} />
            </button>
          </BentoCard>

          <BentoCard variants={itemVariants}>
            <div>
              <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-6 transition-colors duration-300 border border-purple-100 dark:border-transparent">
                <FileText size={20} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white transition-colors duration-300">Automated Invoicing</h3>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed transition-colors duration-300">
                Premium QR invoice rendering, automatic receipt mailing, and integrated tax reconciliation structures.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleFeatureLinkClick('sync')}
              className="mt-6 flex items-center text-xs font-bold text-blue-600 dark:text-indigo-400 gap-1 group-hover:gap-2 hover:gap-2 transition-all cursor-pointer text-left self-start"
            >
              Invoicing specs <ChevronRight size={14} />
            </button>
          </BentoCard>

          <BentoCard variants={itemVariants} className="md:col-span-2">
            <div>
              <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-6 transition-colors duration-300 border border-orange-100 dark:border-transparent">
                <Globe size={20} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white transition-colors duration-300">Multi-Location Syncing</h3>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed transition-colors duration-300">
                Seamless data orchestration between warehouses, shop terminals, and corporate dashboards. Instantly adjust centralized inventory levels on sales events.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleFeatureLinkClick('sync')}
              className="mt-6 flex items-center text-xs font-bold text-blue-600 dark:text-indigo-400 gap-1 group-hover:gap-2 hover:gap-2 transition-all cursor-pointer text-left self-start"
            >
              Learn more about sync <ChevronRight size={14} />
            </button>
          </BentoCard>
        </motion.div>
      </section>

      {/* Pricing Plans Section */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-zinc-200 dark:border-white/5 relative z-20 transition-colors duration-300">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white transition-colors duration-300">
            Sleek, Predictable Pricing Tiers
          </h2>
          <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 transition-colors duration-300">
            Choose the package tailored to your business scale. Save 20% by subscribing to annual billing.
          </p>

          {/* Pricing Controls Wrapper */}
          <div className="mt-8 flex flex-col items-center gap-4">
            
            {/* Billing period Toggle */}
            <div className="inline-flex items-center gap-3 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 transition-colors duration-300">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  billingPeriod === 'annual'
                    ? 'bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Annual Billing
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 font-mono text-[9px] transition-colors duration-300">
                  SAVE 20%
                </span>
              </button>
            </div>

            {/* Localized Currency Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setCurrencySelectorOpen(!currencySelectorOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 bg-white/40 dark:bg-zinc-900/40 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              >
                <span>Billing Location: {currencies[currency].label}</span>
                <span className="text-[10px] text-zinc-400 font-bold font-mono">
                  [{currencies[currency].symbol}]
                </span>
              </button>

              <AnimatePresence>
                {currencySelectorOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setCurrencySelectorOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute left-1/2 -translate-x-1/2 mt-2 w-56 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 shadow-xl z-40 transition-colors duration-300"
                    >
                      {(Object.keys(currencies) as CurrencyCode[]).map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            setCurrency(c);
                            setCurrencySelectorOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                            currency === c
                              ? 'bg-zinc-100 dark:bg-zinc-800 text-blue-600 dark:text-indigo-400'
                              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                          }`}
                        >
                          <span>{currencies[c].label}</span>
                          <span className="font-mono font-bold text-zinc-400">{currencies[c].symbol}</span>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

          </div>
          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch mt-12">
            
            {/* Starter Plan */}
            <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 backdrop-blur-xl p-8 flex flex-col justify-between min-h-[480px] hover:border-zinc-300 dark:hover:border-white/20 transition-all hover:-translate-y-1 duration-300 shadow-sm hover:shadow-md dark:shadow-none">
              <div>
                <p className="text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">Starter Plan</p>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mt-1 transition-colors duration-300">Starter Boutique</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3 transition-colors duration-300">Ideal for single local electronics outlets.</p>
                
                <div className="mt-6 flex items-baseline gap-1 overflow-hidden h-12">
                  <span className="text-4xl font-extrabold text-zinc-900 dark:text-white flex items-center transition-colors duration-300">
                    {currencyInfo.symbol}
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={starterPrice}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="inline-block"
                      >
                        {starterPrice}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium transition-colors duration-300">
                    {billingPeriod === 'annual' ? '/ mo, billed annually' : '/ month'}
                  </span>
                </div>

                <ul className="mt-8 space-y-4">
                  {[
                    '1 Physical Location Only',
                    'Up to 3 Logged-in Staff Users',
                    'Standard POS billing system',
                    'Local Dexie Cache Sync',
                    'Basic PDF Invoices',
                  ].map((feat, i) => (
                    <li key={i} className="flex items-center text-xs text-zinc-600 dark:text-zinc-300 transition-colors duration-300">
                      <Check size={14} className="text-blue-600 dark:text-indigo-400 mr-2.5 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  navigate(`/checkout?plan=starter&billing=${billingPeriod}&currency=${currency}`);
                }}
                className="w-full inline-flex items-center justify-center px-4 py-3 text-sm font-bold rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-white hover:bg-zinc-50 dark:hover:bg-white/5 transition-all mt-8 bg-white dark:bg-transparent"
              >
                Provision Starter Now
              </motion.button>
            </div>

            {/* Pro Tier (Highlighted with glowing gradient border) */}
            <div className="relative p-px rounded-2xl overflow-hidden group flex flex-col min-h-[480px]">
              {/* Animated glowing gradient border trick (dark mode primarily) */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-indigo-500 to-emerald-400 dark:from-cyan-500 dark:via-purple-500 dark:to-fuchsia-500 opacity-30 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative rounded-[15px] bg-white dark:bg-zinc-900 p-8 flex flex-col justify-between flex-1 transition-colors duration-300 shadow-xl shadow-indigo-500/10 dark:shadow-none">
                
                {/* Floating Best Value Badge */}
                <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-indigo-500 dark:to-purple-500 text-white text-[9px] font-extrabold uppercase px-4 py-1.5 rounded-full tracking-wider shadow-lg">
                  RECOMMENDED BEST VALUE
                </div>
                
                <div>
                  <p className="text-xs font-bold tracking-wider text-blue-600 dark:text-indigo-400 uppercase transition-colors duration-300">Enterprise Scale</p>
                  <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mt-1 transition-colors duration-300">TechBill Pro</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3 transition-colors duration-300">Tailored for fast-growing electronic chain retailers.</p>
                  
                  <div className="mt-6 flex items-baseline gap-1 overflow-hidden h-12">
                    <span className="text-4xl font-extrabold text-zinc-900 dark:text-white flex items-center transition-colors duration-300">
                      {currencyInfo.symbol}
                      <AnimatePresence mode="popLayout">
                        <motion.span
                          key={proPrice}
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -20, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          className="inline-block"
                        >
                          {proPrice}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium transition-colors duration-300">
                      {billingPeriod === 'annual' ? '/ mo, billed annually' : '/ month'}
                    </span>
                  </div>

                  <ul className="mt-8 space-y-4">
                    {[
                      'Up to 3 Physical Locations',
                      'Unlimited Cashier & Owner Accounts',
                      'Full Telemetry Analytics Dashboard',
                      'Automated Purchase Requisitions',
                      'Advanced QR-coded Digital Invoices',
                      'Priority Email & Discord Support',
                    ].map((feat, i) => (
                      <li key={i} className="flex items-center text-xs text-zinc-800 dark:text-white transition-colors duration-300">
                        <Check size={14} className="text-blue-500 dark:text-cyan-400 mr-2.5 shrink-0" />
                        <span className="font-medium">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    navigate(`/checkout?plan=pro&billing=${billingPeriod}&currency=${currency}`);
                  }}
                  className="w-full inline-flex items-center justify-center px-4 py-3 text-sm font-bold rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all mt-8 shadow-md"
                >
                  Provision Pro Core
                </motion.button>
              </div>
            </div>

            {/* Enterprise Tier */}
            <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 backdrop-blur-xl p-8 flex flex-col justify-between min-h-[480px] hover:border-zinc-300 dark:hover:border-white/20 transition-all hover:-translate-y-1 duration-300 shadow-sm hover:shadow-md dark:shadow-none">
              <div>
                <p className="text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">Custom Deployment</p>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mt-1 transition-colors duration-300">Industrial Enterprise</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3 transition-colors duration-300">Built for large-scale distributor chains & logistics hubs.</p>
                
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-zinc-900 dark:text-white transition-colors duration-300">Custom</span>
                </div>

                <ul className="mt-8 space-y-4">
                  {[
                    'Unlimited Sync Locations',
                    'Dedicated Multi-Tenant DB Instance',
                    'Custom ERP Integration Pipelines',
                    'Offline POS Auto-Recovery Engine',
                    'Dedicated Technical SLA (99.99%)',
                    '24/7 Phone & Slack VIP Support',
                  ].map((feat, i) => (
                    <li key={i} className="flex items-center text-xs text-zinc-600 dark:text-zinc-300 transition-colors duration-300">
                      <Check size={14} className="text-blue-600 dark:text-indigo-400 mr-2.5 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
              
              <motion.a
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                href="mailto:enterprise@techbill.io?subject=Enterprise%20Quote%20Request"
                className="w-full inline-flex items-center justify-center px-4 py-3 text-sm font-bold rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-white hover:bg-zinc-50 dark:hover:bg-white/5 transition-all mt-8 text-center bg-white dark:bg-transparent"
              >
                Request Enterprise Quote
              </motion.a>
            </div>
          </div>
        </div>
      </section>

      {/* The Architects Section */}
      <section id="architects" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-zinc-200 dark:border-white/5 transition-colors duration-300">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white transition-colors duration-300">
            The Architects Behind TechBill
          </h2>
          <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 transition-colors duration-300">
            Co-founded by elite system designers with a vision of creating ultra-scalable, low-latency, industrial-grade AI and SaaS infrastructure.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-12">
            
            {/* TalhaRana */}
            <div className="group relative rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 backdrop-blur-xl p-8 transition-all hover:shadow-md dark:hover:shadow-none duration-300 overflow-hidden text-left shadow-sm">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 dark:from-[#c0c1ff] dark:to-indigo-500 flex items-center justify-center text-white dark:text-[#1000a9] text-2xl font-extrabold shadow-lg shrink-0 relative">
                  <div className="absolute inset-[-4px] rounded-full bg-blue-500/20 dark:bg-[#c0c1ff]/20 blur-md -z-10 group-hover:scale-110 transition-transform" />
                  TR
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white transition-colors duration-300">TalhaRana</h3>
                  <p className="text-sm font-semibold text-blue-600 dark:text-indigo-400 mt-0.5 transition-colors duration-300">Co-Founder & Chief System Architect</p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                    <a href="https://www.linkedin.com/in/talharana32/" target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      <Linkedin size={16} />
                    </a>
                  </div>
                </div>
              </div>
              <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed transition-colors duration-300">
                Talha handles backend scaling systems and database architecture. He leads the design of the microservices telemetry layer, multitenancy database isolation, and offline cache queuing synchronization routines.
              </p>
              <div className="flex flex-wrap gap-2 mt-6">
                {['Distributed APIs', 'DB Optimization', 'Tenant Security', 'SaaS Scaling'].map((tag, i) => (
                  <span key={i} className="px-2.5 py-1 rounded bg-zinc-50 dark:bg-zinc-800/80 text-[10px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-cyan-400/40 transition-all">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* KrishBaresha */}
            <div className="group relative rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 backdrop-blur-xl p-8 transition-all hover:shadow-md dark:hover:shadow-none duration-300 overflow-hidden text-left shadow-sm">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-emerald-500 dark:from-indigo-500 dark:to-[#2fd9f4] flex items-center justify-center text-white dark:text-[#1000a9] text-2xl font-extrabold shadow-lg shrink-0 relative">
                  <div className="absolute inset-[-4px] rounded-full bg-emerald-500/20 dark:bg-[#2fd9f4]/20 blur-md -z-10 group-hover:scale-110 transition-transform" />
                  KB
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white transition-colors duration-300">KrishBaresha</h3>
                  <p className="text-sm font-semibold text-blue-600 dark:text-indigo-400 mt-0.5 transition-colors duration-300">Chief Frontend Architect / UI/UX Visionary</p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                    <a href="https://www.linkedin.com/in/krish-baresha/" target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      <Linkedin size={16} />
                    </a>
                  </div>
                </div>
              </div>
              <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed transition-colors duration-300">
                Krish co-architected the entire system topology alongside Talha and led the complete UI/UX engineering lifecycle. He engineered the lightning-fast Point of Sale checkout interface, client-side database cache sync engines, and responsive layout foundations.
              </p>

              <div className="flex flex-wrap gap-2 mt-6">
                {['React / TypeScript', 'Tailwind Styling', 'Interaction UX', 'Performance Tuning'].map((tag, i) => (
                  <span key={i} className="px-2.5 py-1 rounded bg-zinc-50 dark:bg-zinc-800/80 text-[10px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-cyan-400/40 transition-all">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>        
        </div>
      </section>
    </div>
  );
}
"""

with open(r'd:\Tech-Bill\techbill-pos\src\pages\LandingPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("LandingPage.tsx rewritten successfully!")
