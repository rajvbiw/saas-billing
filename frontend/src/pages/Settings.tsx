import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Settings as SettingsIcon, ShieldAlert, Sparkles, Building2, Bell, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export const Settings: React.FC = () => {
  const { tenant } = useAuth();
  const [companyName, setCompanyName] = useState(tenant?.companyName || '');
  const [customDomain, setCustomDomain] = useState('');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // Simulated settings save
    setTimeout(() => {
      setSaving(false);
      toast.success('Workspace profile settings updated!');
    }, 800);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">Workspace Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Configure workspace profiles, alert configurations, and custom domains.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Left Side forms */}
        <div className="md:col-span-2 space-y-8">
          
          {/* Org profile configuration */}
          <form onSubmit={handleSaveProfile} className="bg-white border border-gray-200 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="text-indigo-600" size={18} />
              <h3 className="font-bold text-lg text-gray-950">Company Profile</h3>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Organization Name</label>
                <input 
                  type="text" 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500 bg-gray-50/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Subdomain Domain</label>
                <input 
                  type="text" 
                  disabled
                  value={tenant?.subdomain || ''}
                  className="w-full text-sm border border-gray-200 rounded-xl py-2 px-3 bg-gray-100 text-gray-400 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Custom Domain (CNAME alias)</label>
              <input 
                type="text" 
                placeholder="e.g., app.mycompany.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500 bg-gray-50/50"
              />
              <span className="text-[10px] text-gray-400 block mt-1">Configure your DNS CNAME record to point to {tenant?.subdomain} first.</span>
            </div>

            <button 
              type="submit" 
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white text-xs font-semibold py-2.5 px-6 rounded-xl transition"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>

          {/* Email alert configs */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="text-indigo-600" size={18} />
              <h3 className="font-bold text-lg text-gray-950">Notification Preferences</h3>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-gray-900">Dunning & Dials Alert Dispatch</span>
                <p className="text-xs text-gray-400">Receive emails if credit card payments fail or trials expire.</p>
              </div>
              <input 
                type="checkbox" 
                checked={emailAlerts}
                onChange={() => setEmailAlerts(!emailAlerts)}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
            </div>
          </div>

        </div>

        {/* Right Side Danger Zone */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-6 hover:shadow-sm transition">
            <div className="flex items-center gap-2 text-red-600">
              <ShieldAlert size={18} />
              <h3 className="font-bold text-lg">Danger Zone</h3>
            </div>
            
            <p className="text-xs text-gray-400 leading-relaxed">
              Deleting your organization will instantly wipe the isolated RDS database schema and tear down k8s namespace deployments.
            </p>

            <button 
              onClick={() => toast.error('Workspace deletion request locked. Contact platform admin.')}
              className="w-full text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5"
            >
              Delete Organization Workspace
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
