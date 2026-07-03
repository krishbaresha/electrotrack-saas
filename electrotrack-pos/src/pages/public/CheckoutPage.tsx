import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, CreditCard, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';

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
    starterPrice: { monthly: 13900, annual: 10900 },
    proPrice: { monthly: 27900, annual: 22000 },
    label: 'Pakistan (PKR)',
  },
  EUR: {
    symbol: '€',
    starterPrice: { monthly: 46, annual: 36 },
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

// Production Forwarding Integration URLs for Lemon Squeezy
// When integrating live stores, redirect the user directly to these URLs
// e.g., window.location.href = LEMON_SQUEEZY_STORE_URLS[`${plan}_${billing}`]
export const LEMON_SQUEEZY_STORE_URLS = {
  starter_monthly: 'https://electrotrack.lemonsqueezy.com/checkout/buy/starter-monthly-placeholder-id',
  starter_annual: 'https://electrotrack.lemonsqueezy.com/checkout/buy/starter-annual-placeholder-id',
  pro_monthly: 'https://electrotrack.lemonsqueezy.com/checkout/buy/pro-monthly-placeholder-id',
  pro_annual: 'https://electrotrack.lemonsqueezy.com/checkout/buy/pro-annual-placeholder-id',
};

export default function CheckoutPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Parse parameters (fallback to Pro annual if invalid/missing)
  const rawPlan = searchParams.get('plan')?.toLowerCase();
  const plan: 'starter' | 'pro' = rawPlan === 'starter' ? 'starter' : 'pro';
  
  const rawBilling = searchParams.get('billing')?.toLowerCase();
  const billing: 'monthly' | 'annual' = rawBilling === 'monthly' ? 'monthly' : 'annual';

  const [currency, setCurrency] = useState<CurrencyCode>(() => detectCurrency());
  const [currencySelectorOpen, setCurrencySelectorOpen] = useState(false);

  // Form inputs
  const [email, setEmail] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [checkoutState, setCheckoutState] = useState<'idle' | 'processing' | 'success'>('idle');

  // Pricing values
  const currencyInfo = currencies[currency];
  const price = plan === 'starter' 
    ? (billing === 'annual' ? currencyInfo.starterPrice.annual : currencyInfo.starterPrice.monthly)
    : (billing === 'annual' ? currencyInfo.proPrice.annual : currencyInfo.proPrice.monthly);

  const planDisplayName = plan === 'starter' ? 'Starter Boutique Plan' : 'ElectroTrack Pro Plan';

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !cardNumber || !cardExpiry || !cardCvc) return;
    
    setCheckoutState('processing');
    setTimeout(() => {
      setCheckoutState('success');
      setTimeout(() => {
        setCheckoutState('idle');
        navigate('/');
      }, 2500);
    }, 2500);
  };

  const handlePlanToggle = () => {
    const nextPlan = plan === 'starter' ? 'pro' : 'starter';
    setSearchParams({ plan: nextPlan, billing });
  };

  const handleBillingToggle = () => {
    const nextBilling = billing === 'monthly' ? 'annual' : 'monthly';
    setSearchParams({ plan, billing: nextBilling });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 relative z-10 flex flex-col justify-center min-h-[calc(100vh-16rem)]">
      {/* Back button */}
      <div className="mb-6">
        <Link 
          to="/#pricing" 
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 dark:text-[#c7c4d7] dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Back to pricing
        </Link>
      </div>

      <div className="bg-white dark:bg-[#12182b] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[550px] transition-all">
        {/* Left Side: Summary Panel */}
        <div className="w-full md:w-5/12 bg-slate-50 dark:bg-[#0c101f] p-8 border-b md:border-b-0 md:border-r border-slate-200 dark:border-white/5 flex flex-col justify-between">
          <div className="space-y-8">
            <div className="flex items-center gap-2">
              <img src="/favicon.svg" alt="ElectroTrack" className="h-6 w-6" />
              <span className="font-space text-sm font-bold text-slate-900 dark:text-white">
                ElectroTrack Pay
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">
                Selected Plan
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <h3 className="font-space text-xl font-bold text-slate-950 dark:text-white">
                  {planDisplayName}
                </h3>
                <button
                  type="button"
                  onClick={handlePlanToggle}
                  className="text-xs font-bold text-indigo-600 dark:text-[#2fd9f4] hover:underline"
                >
                  Change
                </button>
              </div>
              
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/50 dark:border-white/5">
                <p className="text-xs text-slate-500 dark:text-[#c7c4d7]">
                  Billing cycle: <span className="capitalize font-semibold text-slate-700 dark:text-white">{billing}</span>
                </p>
                <button
                  type="button"
                  onClick={handleBillingToggle}
                  className="text-xs font-bold text-indigo-600 dark:text-[#2fd9f4] hover:underline"
                >
                  {billing === 'annual' ? 'Switch to Monthly' : 'Switch to Annual'}
                </button>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200/50 dark:border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">
                Summary Total
              </span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-extrabold text-slate-950 dark:text-white font-space">
                  {currencyInfo.symbol}{price}
                </span>
                <span className="text-xs text-slate-400 dark:text-white/30 font-medium">
                  /{billing === 'annual' ? 'yr' : 'mo'}
                </span>
              </div>
              {billing === 'annual' && (
                <p className="mt-1.5 text-xs text-emerald-500 font-bold font-mono">
                  Annual discount applied (Saved 20%)
                </p>
              )}
            </div>
            
            {/* Dynamic Localized Currency Selector */}
            <div className="relative pt-6 border-t border-slate-200/50 dark:border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30 block mb-2">
                Checkout Region
              </span>
              <button
                type="button"
                onClick={() => setCurrencySelectorOpen(!currencySelectorOpen)}
                className="flex items-center justify-between w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] text-xs font-bold text-slate-700 dark:text-[#c7c4d7] hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
              >
                <span>{currencyInfo.label}</span>
                <span className="text-xs text-slate-400 font-mono">[{currencyInfo.symbol}]</span>
              </button>

              <AnimatePresence>
                {currencySelectorOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setCurrencySelectorOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 mb-2 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#12182b] p-1.5 shadow-xl z-40"
                    >
                      {(Object.keys(currencies) as CurrencyCode[]).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setCurrency(c);
                            setCurrencySelectorOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                            currency === c
                              ? 'bg-slate-100 dark:bg-white/5 text-indigo-600 dark:text-[#2fd9f4]'
                              : 'text-slate-600 dark:text-[#c7c4d7] hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                          }`}
                        >
                          <span>{currencies[c].label}</span>
                          <span className="font-mono font-bold text-slate-400">{currencies[c].symbol}</span>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/5">
            <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-white/40 font-medium font-mono">
              <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
              Secured & locally processed
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-white/20 font-mono mt-1 pl-5">
              Powered by Lemon Squeezy Sandbox
            </div>
          </div>
        </div>

        {/* Right Side: Form Flow Panel */}
        <div className="w-full md:w-7/12 p-8 md:p-12 flex flex-col justify-center bg-white dark:bg-[#12182b]">
          {checkoutState === 'idle' && (
            <form onSubmit={handleCheckout} className="space-y-5 animate-fadeIn">
              <div className="mb-2">
                <h2 className="font-space text-lg font-bold text-slate-950 dark:text-white">
                  Payment Details
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#c7c4d7] mt-1">
                  Complete your details below to activate your sandbox subscription.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="manager@boutique.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.01] text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-wider">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Talha Rana"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.01] text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-sans"
                />
              </div>

              <div className="space-y-1.5 font-sans">
                <label className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-wider">
                  Card Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="4242 4242 4242 4242"
                    maxLength={19}
                    value={cardNumber}
                    onChange={(e) => {
                      // auto space formatting
                      const val = e.target.value.replace(/\s+/g, '').replace(/[^0-8a-zA-Z]/gi, '');
                      const matches = val.match(/\d{4,16}/g);
                      const match = (matches && matches[0]) || '';
                      const parts = [];

                      for (let i = 0, len = match.length; i < len; i += 4) {
                        parts.push(match.substring(i, i + 4));
                      }

                      if (parts.length > 0) {
                        setCardNumber(parts.join(' '));
                      } else {
                        setCardNumber(val);
                      }
                    }}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.01] text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                  />
                  <CreditCard className="absolute left-3.5 top-3 text-slate-400" size={16} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-wider">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="MM/YY"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length >= 2) {
                        setCardExpiry(`${val.slice(0, 2)}/${val.slice(2, 4)}`);
                      } else {
                        setCardExpiry(val);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.01] text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-sans"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-wider">
                    CVC / CVV
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="123"
                    maxLength={4}
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.01] text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-sans"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center py-3 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-[#c0c1ff] dark:text-[#1000a9] dark:hover:bg-[#c0c1ff]/90 transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/10 dark:shadow-none mt-4"
              >
                Subscribe with ElectroTrack Pay
              </button>
            </form>
          )}

          {checkoutState === 'processing' && (
            <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center animate-pulse">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600 dark:text-[#c0c1ff]" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-950 dark:text-white">
                  Verifying sandbox transaction...
                </p>
                <p className="text-xs text-slate-500 dark:text-[#c7c4d7]">
                  Contacting Lemon Squeezy Mock Gateway API
                </p>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-white/30 font-mono">
                Do not leave or refresh this screen
              </p>
            </div>
          )}

          {checkoutState === 'success' && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center justify-center space-y-4 py-12 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center mb-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 animate-bounce" />
              </div>
              <div className="space-y-1">
                <h3 className="font-space text-lg font-bold text-slate-950 dark:text-white">
                  Payment Confirmed!
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#c7c4d7]">
                  Thank you for subscribing.
                </p>
              </div>
              <p className="text-xs text-slate-400 dark:text-white/30 max-w-[240px]">
                Redirecting back to your landing dashboard...
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
