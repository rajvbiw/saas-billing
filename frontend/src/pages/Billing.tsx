import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, ArrowUpRight, Download, Check, ShieldCheck, HelpCircle, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const stripePromise = loadStripe('pk_test_mock');

// Card Checkout Form Component
const CardCheckoutForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) return;

      // Create Payment Method
      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (error) {
        toast.error(error.message || 'Payment method compilation failed.');
      } else {
        // Submit to Backend
        await api.post('/billing/payment-methods', { payment_method_id: paymentMethod.id });
        toast.success('Card attached successfully!');
        cardElement.clear();
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to link credit card.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 border border-gray-100 p-6 rounded-2xl">
      <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Add New Credit Card</span>
      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <CardElement options={{ style: { base: { fontSize: '14px', fontFamily: 'Outfit, sans-serif' } } }} />
      </div>
      <button 
        type="submit" 
        disabled={submitting || !stripe}
        className="w-full text-xs font-semibold bg-gray-800 hover:bg-gray-950 disabled:bg-gray-200 text-white py-2 rounded-xl transition flex items-center justify-center gap-1.5"
      >
        {submitting ? <Loader2 className="animate-spin" size={14} /> : <><CreditCard size={14} /> Link Card</>}
      </button>
    </form>
  );
};

export const Billing: React.FC = () => {
  const { tenant } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState<number | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);

  const fetchBillingData = async () => {
    try {
      const [plansRes, invoicesRes, cardsRes] = await Promise.all([
        api.get('/billing/plans'),
        api.get('/billing/invoices'),
        api.get('/billing/payment-methods')
      ]);
      setPlans(plansRes.data);
      setInvoices(invoicesRes.data.invoices || []);
      setCards(cardsRes.data || []);
    } catch (err: any) {
      console.error('Failed to load billing records:', err);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const handlePortalRedirect = async () => {
    setPortalLoading(true);
    try {
      const res = await api.post('/billing/portal', { return_url: window.location.href });
      window.location.href = res.data.url;
    } catch (error) {
      toast.error('Failed to open Stripe billing portal.');
    } finally {
      setPortalLoading(false);
    }
  };

  const handlePlanChange = async (planId: number) => {
    setUpgradeLoading(planId);
    try {
      await api.put('/billing/upgrade', { plan_id: planId });
      toast.success('Your subscription tier was upgraded!');
      window.location.reload();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Upgrade action failed.');
    } finally {
      setUpgradeLoading(null);
    }
  };

  const handleCancelSub = async () => {
    if (!window.confirm('Are you sure you want to schedule subscription cancellation? Service remains active until end of term.')) return;
    try {
      await api.put('/billing/cancel');
      toast.success('Subscription scheduled for cancellation.');
      fetchBillingData();
    } catch (error) {
      toast.error('Failed to cancel subscription.');
    }
  };

  const handleReactivateSub = async () => {
    try {
      await api.post('/billing/reactivate');
      toast.success('Subscription reactivated!');
      fetchBillingData();
    } catch (error) {
      toast.error('Failed to reactivate subscription.');
    }
  };

  const deleteCard = async (pmId: string) => {
    try {
      await api.delete(`/billing/payment-methods/${pmId}`);
      toast.success('Card detached.');
      fetchBillingData();
    } catch (error) {
      toast.error('Failed to detach card.');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">Billing & Subscriptions</h1>
        <p className="text-sm text-gray-400 mt-1">Manage payment cards, invoice pdf links, and subscription tiers.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Left Grid Tiers selection */}
        <div className="md:col-span-2 space-y-8">
          
          {/* Active Plan Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white space-y-6 shadow-xl shadow-indigo-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest bg-indigo-500/50 py-1 px-3.5 rounded-full">
                Active Tier
              </span>
              <span className="text-xs text-indigo-200">ID: {tenant?.stripe_subdomain || tenant?.slug}</span>
            </div>

            <div>
              <h2 className="text-3xl font-black">{tenant?.plan?.name || 'Pro'} Workspace</h2>
              <p className="text-xs text-indigo-100 mt-1">Status: Active</p>
            </div>

            <div className="pt-6 border-t border-indigo-500/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <button 
                onClick={handlePortalRedirect}
                disabled={portalLoading}
                className="bg-white hover:bg-gray-50 text-indigo-600 font-semibold py-3 px-6 rounded-2xl text-xs transition flex items-center justify-center gap-1.5"
              >
                {portalLoading ? <Loader2 className="animate-spin" size={14} /> : <><ArrowUpRight size={14} /> Stripe Customer Portal</>}
              </button>
              
              <button 
                onClick={handleCancelSub}
                className="text-indigo-200 hover:text-white text-xs font-semibold underline transition text-left sm:text-right"
              >
                Cancel Subscription
              </button>
            </div>
          </div>

          {/* Tier Cards Selectors */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-gray-950">Change Billing Plan</h3>
            <div className="grid sm:grid-cols-3 gap-6">
              {plans.map((p) => {
                const isActive = tenant?.plan?.id === p.id;
                return (
                  <div 
                    key={p.id} 
                    className={`bg-white border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                      isActive 
                        ? 'border-indigo-600 ring-1 ring-indigo-600' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-gray-400 uppercase">{p.name}</span>
                      <div className="flex items-baseline gap-0.5 mt-2">
                        <span className="text-xl font-bold text-gray-950">${parseFloat(p.price_monthly).toFixed(0)}</span>
                        <span className="text-gray-400 text-[10px]">/mo</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => handlePlanChange(p.id)}
                      disabled={isActive || upgradeLoading !== null}
                      className={`w-full text-xs font-semibold py-2 rounded-xl mt-4 transition flex items-center justify-center ${
                        isActive 
                          ? 'bg-indigo-50 text-indigo-600 cursor-default' 
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {upgradeLoading === p.id ? <Loader2 className="animate-spin" size={12} /> : isActive ? 'Current' : 'Select'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Invoices List */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-gray-950">Invoice Log Trails</h3>
            <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
              {invoices.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-12">No invoices billed yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 uppercase">
                      <tr>
                        <th className="py-3 px-6">Invoice ID</th>
                        <th className="py-3 px-6">Amount</th>
                        <th className="py-3 px-6">Period</th>
                        <th className="py-3 px-6">Status</th>
                        <th className="py-3 px-6 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-600">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50/50">
                          <td className="py-3 px-6 font-mono text-[11px] truncate max-w-[120px]">{inv.stripe_invoice_id}</td>
                          <td className="py-3 px-6 font-semibold text-gray-950">${parseFloat(inv.amount_paid).toFixed(2)}</td>
                          <td className="py-3 px-6">
                            {new Date(inv.period_start).toLocaleDateString()} - {new Date(inv.period_end).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-6">
                            <span className={`py-0.5 px-2 rounded-full text-[10px] font-semibold ${
                              inv.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-6 text-right">
                            {inv.invoice_pdf_url ? (
                              <a 
                                href={inv.invoice_pdf_url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                              >
                                <Download size={12} /> PDF
                              </a>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Grid Stripe Credit Cards */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-6 hover:shadow-sm transition">
            <h3 className="font-bold text-lg text-gray-950">Payment Cards</h3>
            
            <div className="space-y-4">
              {cards.map((c) => (
                <div key={c.id} className="border border-gray-100 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-900 block capitalize">{c.card?.brand} •••• {c.card?.last4}</span>
                      <span className="text-[10px] text-gray-400">Expires {c.card?.exp_month}/{c.card?.exp_year}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteCard(c.id)}
                    className="text-[10px] text-red-600 hover:underline font-semibold"
                  >
                    Detach
                  </button>
                </div>
              ))}

              {cards.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">No credit cards connected.</p>
              )}
            </div>

            {showCardForm ? (
              <Elements stripe={stripePromise}>
                <CardCheckoutForm onSuccess={() => { setShowCardForm(false); fetchBillingData(); }} />
              </Elements>
            ) : (
              <button 
                onClick={() => setShowCardForm(true)}
                className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 text-gray-700 py-2.5 rounded-xl hover:bg-gray-100 transition"
              >
                Add Credit Card
              </button>
            )}
          </div>

          <div className="bg-indigo-50/50 border border-indigo-100 rounded-3xl p-6 text-xs text-indigo-700 leading-relaxed space-y-3">
            <span className="font-bold text-indigo-950 block">Billing Guidelines</span>
            <p>
              Credit card transactions are secured via Stripe SSL vaults. SaaSPlatform does not record raw card numbers. Invoices are dispatched to the organizational admin on successful clearing.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};
