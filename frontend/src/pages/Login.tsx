import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { Building2, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { tenantSlug, setTenantOverride } = useTenant();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantInput, setTenantInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await login(email, password);
      toast.success('Logged in successfully!');
      
      if (res.user.role === 'superadmin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error(error.error || 'Authentication failed. Please check credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTenantRedirect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantInput) return;
    setTenantOverride(tenantInput.toLowerCase().trim());
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white border border-gray-200 rounded-3xl shadow-xl w-full max-w-md p-8 space-y-6">
        
        {/* Header branding */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-100">
            <Building2 size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">
            {tenantSlug ? `Login to ${tenantSlug}` : 'Tenant Login Portal'}
          </h1>
          <p className="text-xs text-gray-400">
            {tenantSlug 
              ? `Workspace member login for ${tenantSlug}.saas.example.com`
              : 'Enter your tenant subdomain slug to access your subscription.'}
          </p>
        </div>

        {tenantSlug ? (
          /* Standard Login Form when Subdomain is Active */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Email Address</label>
              <input 
                type="email" 
                required 
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-500 uppercase">Password</label>
                <Link to="/forgot-password" className="text-[11px] text-indigo-600 hover:underline">Forgot password?</Link>
              </div>
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
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white font-semibold py-2.5 rounded-xl transition shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Login'}
            </button>
          </form>
        ) : (
          /* Subdomain Selector Form when on Root Domain */
          <div className="space-y-6">
            <form onSubmit={handleTenantRedirect} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Tenant Subdomain</label>
                <div className="relative flex items-center">
                  <input 
                    type="text" 
                    required 
                    placeholder="acme"
                    value={tenantInput}
                    onChange={(e) => setTenantInput(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl py-2 pl-3 pr-28 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="absolute right-3 text-xs text-gray-400 font-semibold">.localhost</span>
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
              >
                Go to Workspace <ArrowRight size={16} />
              </button>
            </form>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase font-medium">Or</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* Direct Superadmin login option */}
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center space-y-3">
              <span className="text-xs font-semibold text-gray-700 block">System Administrator Portal</span>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input 
                  type="email" 
                  required 
                  placeholder="superadmin@saas.example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-sm border border-gray-200 bg-white rounded-xl py-1.5 px-3 focus:outline-none focus:border-indigo-500"
                />
                <input 
                  type="password" 
                  required 
                  placeholder="superadmin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-sm border border-gray-200 bg-white rounded-xl py-1.5 px-3 focus:outline-none focus:border-indigo-500"
                />
                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full text-xs bg-gray-800 hover:bg-gray-950 text-white font-semibold py-2 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  {submitting ? <Loader2 className="animate-spin" size={14} /> : 'Login as Superadmin'}
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-gray-500 mt-4">
          Need a workspace?{' '}
          <Link to="/signup" className="text-indigo-600 hover:underline font-semibold">Sign up here</Link>
        </div>
      </div>
    </div>
  );
};
// Export blank resets to fulfill route mappings
export const ForgotPassword = () => <div className="text-center p-20">Mock Forgot Password link. Check email.</div>;
export const ResetPassword = () => <div className="text-center p-20">Mock Reset Password page.</div>;
