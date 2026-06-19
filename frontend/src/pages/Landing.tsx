import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Zap, Sparkles, Check, ArrowRight } from 'lucide-react';

export const Landing: React.FC = () => {
  const plans = [
    {
      id: 1,
      name: 'Starter',
      price: '$29',
      period: 'month',
      users: 'Up to 5 Users',
      apiCalls: '10,000 API calls',
      storage: '10GB storage space',
      badgeColor: 'bg-gray-100 text-gray-800',
      description: 'Ideal for early-stage B2B projects testing the waters.'
    },
    {
      id: 2,
      name: 'Pro',
      price: '$99',
      period: 'month',
      users: 'Up to 25 Users',
      apiCalls: '100,000 API calls',
      storage: '100GB storage space',
      badgeColor: 'bg-indigo-100 text-indigo-800 ring-2 ring-indigo-300',
      description: 'Perfect for fast-growing startups needing premium bandwidth.'
    },
    {
      id: 3,
      name: 'Enterprise',
      price: '$299',
      period: 'month',
      users: 'Unlimited Users',
      apiCalls: '1,000,000 API calls',
      storage: '1TB storage space',
      badgeColor: 'bg-purple-100 text-purple-800 ring-2 ring-purple-300',
      description: 'Tailored for production scale with isolated resources.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/20 via-white to-gray-50/50">
      
      {/* Navbar */}
      <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg text-white font-bold">⚡</div>
          <span className="font-bold text-xl tracking-tight text-gray-900">SaaSPlatform</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-semibold text-gray-600 hover:text-indigo-600 transition">
            Login
          </Link>
          <Link to="/signup" className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition shadow-md shadow-indigo-100">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto text-center px-6 pt-16 pb-20">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100/50 text-indigo-600 text-xs font-semibold mb-6 animate-pulse">
          <Sparkles size={12} /> Live Stripe Billing Enabled
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-gray-900 tracking-tight leading-none">
          Accelerate Your Enterprise <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">SaaS Platform Infrastructure</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Instantly provision subdomains, isolated database environments, metered usage-based analytics, and self-service Stripe subscription management.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link to="/signup" className="w-full sm:w-auto flex items-center justify-center gap-2 py-4 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl transition shadow-lg shadow-indigo-200/50">
            Register Organization <ArrowRight size={18} />
          </Link>
          <a href="#pricing" className="w-full sm:w-auto py-4 px-8 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold rounded-2xl transition">
            Compare Pricing
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-gray-100">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6">
              <Zap size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-950 mb-2">Isolated Databases</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Every organization gets its own dedicated database node, preventing resource bleeding and strengthening tenant-level security checks.
            </p>
          </div>
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6">
              <Shield size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-950 mb-2">Secure Subdomains</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Automatic provisioning binds individual namespaces, subdomain aliases, SSL handshakes, and route policies.
            </p>
          </div>
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6">
              <Sparkles size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-950 mb-2">Self-Service Billing</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Integrated payment gateways, Stripe Element forms, invoice download trails, and Stripe customer portal sessions.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-950 tracking-tight">Simple, Growth-Driven Billing Tiers</h2>
          <p className="text-gray-500 mt-4">Transparent monthly subscription structures scaling directly with your workspace needs.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((p) => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-3xl p-8 flex flex-col justify-between hover:border-indigo-500 hover:shadow-xl transition-all duration-300 relative">
              {p.id === 2 && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                  Most Popular
                </span>
              )}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-xs font-bold uppercase py-1 px-3 rounded-full ${p.badgeColor}`}>{p.name}</span>
                </div>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-4xl font-black text-gray-950">{p.price}</span>
                  <span className="text-gray-400 text-sm">/{p.period}</span>
                </div>
                <p className="text-xs text-gray-400 mb-6">{p.description}</p>
                <div className="space-y-3 pt-6 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check size={16} className="text-indigo-600" /> <span>{p.users}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check size={16} className="text-indigo-600" /> <span>{p.apiCalls}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check size={16} className="text-indigo-600" /> <span>{p.storage}</span>
                  </div>
                </div>
              </div>
              <div className="mt-8">
                <Link 
                  to={`/signup?plan=${p.id}`} 
                  className={`w-full block text-center py-3 px-6 rounded-2xl font-semibold transition ${
                    p.id === 2 
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100' 
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  Choose {p.name}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-12 text-center text-xs text-gray-400 max-w-7xl mx-auto">
        <p>&copy; {new Date().getFullYear()} SaaS Platform. All Rights Reserved. Built for high performance scale.</p>
      </footer>
    </div>
  );
};
