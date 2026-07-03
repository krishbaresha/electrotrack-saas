import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, CreditCard, Loader2, CheckCircle2 } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  price: string;
  currency: string;
  billingPeriod: 'monthly' | 'annual';
}

export default function CheckoutModal({
  isOpen,
  onClose,
  planName,
  price,
  currency,
  billingPeriod,
}: CheckoutModalProps) {
  const [email, setEmail] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [checkoutState, setCheckoutState] = useState<'idle' | 'processing' | 'success'>('idle');

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setCheckoutState('processing');
    setTimeout(() => {
      setCheckoutState('success');
      setTimeout(() => {
        setCheckoutState('idle');
        onClose();
      }, 2000);
    }, 2500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={checkoutState === 'idle' ? onClose : undefined}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-[#12182b] border border-slate-200 dark:border-white/10 shadow-2xl z-10 flex flex-col md:flex-row min-h-[450px]"
          >
            {/* Close Button */}
            {checkoutState === 'idle' && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all z-20"
              >
                <X size={18} />
              </button>
            )}

            {/* Left Panel: Plan Summary */}
            <div className="w-full md:w-5/12 bg-slate-50 dark:bg-[#0c101f] p-6 border-r border-slate-200 dark:border-white/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <img src="/logo.svg" alt="ElectroTrack" className="h-5 w-auto" />
                  <span className="font-space text-xs font-bold text-slate-900 dark:text-white">
                    ElectroTrack Pay
                  </span>
                </div>

                <div className="mt-8">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">
                    Selected Plan
                  </span>
                  <h3 className="font-space text-lg font-bold text-slate-950 dark:text-white mt-1">
                    {planName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#c7c4d7] mt-1">
                    Billed {billingPeriod}
                  </p>
                </div>

                <div className="mt-8 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-950 dark:text-white font-space">
                    {currency}{price}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-white/30 font-medium">
                    /{billingPeriod === 'annual' ? 'yr' : 'mo'}
                  </span>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-white/40 font-medium font-mono">
                  <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                  Secured & locally processed
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-white/20 font-mono mt-1 pl-5">
                  Powered by Lemon Squeezy Sandbox
                </div>
              </div>
            </div>

            {/* Right Panel: Form Flow */}
            <div className="w-full md:w-7/12 p-6 flex flex-col justify-center">
              {checkoutState === 'idle' && (
                <form onSubmit={handleCheckout} className="space-y-4">
                  <h2 className="font-space text-base font-bold text-slate-950 dark:text-white mb-2">
                    Enter details to subscribe
                  </h2>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. manager@boutique.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase">
                      Card Number
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="4242 4242 4242 4242"
                        maxLength={19}
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <CreditCard className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="MM/YY"
                        maxLength={5}
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase">
                        CVC / CVV
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="123"
                        maxLength={4}
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center py-2.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-[#c0c1ff] dark:text-[#1000a9] dark:hover:bg-[#c0c1ff]/90 transition-all active:scale-[0.98] shadow shadow-indigo-600/10"
                  >
                    Subscribe with ElectroTrack Pay
                  </button>
                </form>
              )}

              {checkoutState === 'processing' && (
                <div className="flex flex-col items-center justify-center space-y-3 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-[#c0c1ff]" />
                  <p className="text-xs font-semibold text-slate-950 dark:text-white">
                    Processing your sandbox subscription...
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-white/30 font-mono">
                    Please do not close this window
                  </p>
                </div>
              )}

              {checkoutState === 'success' && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center justify-center space-y-3 py-8 text-center"
                >
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 animate-bounce" />
                  <h3 className="font-space text-base font-bold text-slate-950 dark:text-white">
                    Subscription Successful!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#c7c4d7] max-w-[200px]">
                    Welcome onboard. Redirecting back to ElectroTrack landing portal...
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
