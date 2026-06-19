import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Check, X, Loader2, Sparkles, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const Signup: React.FC = () => {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPlanFromUrl = searchParams.get('plan') || '1'; // Default plan 1

  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [password, setPassword] = useState('');
  const [planId, setPlanId] = useState(selectedPlanFromUrl);

  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [subdomainError, setSubdomainError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Debounce subdomain lookup
  useEffect(() => {
    if (!subdomain) {
      setSubdomainAvailable(null);
      setSubdomainError('');
      return;
    }

    const timer = setTimeout(async () => {
      const slug = subdomain.toLowerCase().trim();
      if (!/^[a-z0-9-]+$/.test(slug)) {
        setSubdomainAvailable(false);
        setSubdomainError('Dashes, lowercase letters and numbers only.');
        return;
      }

      setCheckingSubdomain(true);
      try {
        const res = await api.post('/onboarding/check-subdomain', { subdomain: slug });
        if (res.data.available) {
          setSubdomainAvailable(true);
          setSubdomainError('');
        } else {
          setSubdomainAvailable(false);
          setSubdomainError(res.data.reason || 'Subdomain already taken.');
        }
      } catch (error: any) {
        setSubdomainAvailable(false);
        setSubdomainError(error.response?.data?.error || 'Validation error');
      } finally {
        setCheckingSubdomain(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [subdomain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subdomainAvailable) {
      toast.error('Please choose an available subdomain before registering.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await register({
        company_name: companyName,
        owner_name: ownerName,
        owner_email: ownerEmail,
        subdomain: subdomain.toLowerCase().trim(),
        password,
        plan_id: parseInt(planId)
      });
      toast.success('Organization registered! Initializing infrastructure...');
      navigate(`/provisioning-progress/${res.tenantId}`);
    } catch (error: any) {
      toast.error(error.error || 'Onboarding registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white border border-gray-200 rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side Highlight Panel */}
        <div className="bg-indigo-600 p-8 text-white md:w-5/12 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-8">
              <Building2 size={24} />
              <span className="font-bold text-lg">SaaSPlatform</span>
            </div>
            <h2 className="text-2xl font-bold mb-4">Launch your startup workspace instantly.</h2>
            <p className="text-xs text-indigo-100 leading-relaxed mb-6">
              Our automated Lambda coordinator provisions RDS MySQL schemas, Route53 CNAMES, and locks down namespaces in a matter of seconds.
            </p>
          </div>
          <div className="border-t border-indigo-500/50 pt-6 space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <Check size={14} className="text-indigo-200" />
              <span>Isolated tenant database</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Check size={14} className="text-indigo-200" />
              <span>Stripe billing trial period</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Check size={14} className="text-indigo-200" />
              <span>Developer API Keys panel</span>
            </div>
          </div>
        </div>

        {/* Right Side Form Panel */}
        <form onSubmit={handleSubmit} className="p-8 md:w-7/12 space-y-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
            <p className="text-xs text-gray-400 mt-1">Configure your organization and administrator credentials.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Company Name</label>
              <input 
                type="text" 
                required 
                placeholder="Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Workspace Plan</label>
              <select 
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl py-2 px-3 bg-white focus:outline-none focus:border-indigo-500"
              >
                <option value="1">Starter Plan ($29/mo)</option>
                <option value="2">Pro Plan ($99/mo)</option>
                <option value="3">Enterprise Plan ($299/mo)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Subdomain Slug</label>
            <div className="relative flex items-center">
              <input 
                type="text" 
                required 
                placeholder="acme"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl py-2 pl-3 pr-28 focus:outline-none focus:border-indigo-500"
              />
              <span className="absolute right-3 text-xs text-gray-400 font-semibold">.saas.example.com</span>
            </div>
            
            {/* Subdomain validation output */}
            <div className="flex items-center gap-1.5 mt-1 text-[11px] min-h-[16px]">
              {checkingSubdomain && (
                <span className="text-gray-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Verifying...</span>
              )}
              {subdomainAvailable === true && (
                <span className="text-green-600 flex items-center gap-1"><Check size={12} /> Subdomain is available!</span>
              )}
              {subdomainAvailable === false && (
                <span className="text-red-500 flex items-center gap-1"><X size={12} /> {subdomainError}</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Owner Full Name</label>
            <input 
              type="text" 
              required 
              placeholder="John Doe"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Owner Email</label>
            <input 
              type="email" 
              required 
              placeholder="john@example.com"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Root Password</label>
            <input 
              type="password" 
              required 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button 
            type="submit" 
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white font-semibold py-3 rounded-2xl transition shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Complete Registration'}
          </button>

          <p className="text-center text-xs text-gray-500 mt-4">
            Already have an organization?{' '}
            <Link to="/login" className="text-indigo-600 hover:underline font-semibold">Login here</Link>
          </p>
        </form>
      </div>
    </div>
  );
};
