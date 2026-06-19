import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { 
  Building2, 
  TrendingUp, 
  Users, 
  Activity, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle,
  Clock,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TenantRecord {
  id: number;
  slug: string;
  company_name: string;
  owner_name: string;
  owner_email: string;
  subdomain: string;
  status: 'trialing' | 'active' | 'suspended' | 'cancelled';
  created_at: string;
  plan?: {
    name: string;
    price_monthly: string;
  };
}

interface RevenueData {
  mrr: number;
  arr: number;
  churnRate: string;
  activeSubscriptions: number;
  revenueTrend: any[];
}

interface UsageData {
  apiCalls: number;
  storageUsage: number;
  usageTrend: any[];
}

export const AdminPanel: React.FC = () => {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAdminData = async () => {
    try {
      const [tenantsRes, revenueRes, usageRes] = await Promise.all([
        api.get(`/admin/tenants?search=${search}&page=${page}`),
        api.get('/admin/revenue'),
        api.get('/admin/usage')
      ]);
      setTenants(tenantsRes.data.tenants || []);
      setTotalPages(tenantsRes.data.totalPages || 1);
      setRevenue(revenueRes.data);
      setUsage(usageRes.data);
    } catch (err: any) {
      toast.error('Failed to load superadmin reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [search, page]);

  const handleSuspend = async (id: number) => {
    if (!window.confirm('Are you sure you want to suspend this tenant? Workspace databases will lock.')) return;
    try {
      await api.put(`/admin/tenants/${id}/suspend`);
      toast.success('Tenant workspace suspended.');
      fetchAdminData();
    } catch (error) {
      toast.error('Failed to suspend tenant.');
    }
  };

  const handleReactivate = async (id: number) => {
    try {
      await api.put(`/admin/tenants/${id}/reactivate`);
      toast.success('Tenant workspace reactivated!');
      fetchAdminData();
    } catch (error) {
      toast.error('Failed to reactivate tenant.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-gray-200 rounded-lg w-1/4"></div>
        <div className="grid md:grid-cols-4 gap-6">
          <div className="h-32 bg-gray-200 rounded-3xl"></div>
          <div className="h-32 bg-gray-200 rounded-3xl"></div>
          <div className="h-32 bg-gray-200 rounded-3xl"></div>
          <div className="h-32 bg-gray-200 rounded-3xl"></div>
        </div>
        <div className="h-96 bg-gray-200 rounded-3xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">Superadmin Control Panel</h1>
        <p className="text-sm text-gray-400 mt-1">Platform-wide statistics, active tenant directory, and subscription health reviews.</p>
      </div>

      {/* Top Cards grid */}
      <div className="grid md:grid-cols-4 gap-6">
        
        <div className="bg-white border border-gray-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase">Platform MRR</span>
            <span className="text-2xl font-bold text-gray-950 block">${revenue?.mrr.toLocaleString()}</span>
            <span className="text-[10px] text-gray-400">Monthly Recurring Revenue</span>
          </div>
          <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase">Platform ARR</span>
            <span className="text-2xl font-bold text-gray-950 block">${revenue?.arr.toLocaleString()}</span>
            <span className="text-[10px] text-gray-400">Annualized Recurring Revenue</span>
          </div>
          <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase">Platform Churn</span>
            <span className="text-2xl font-bold text-gray-950 block">{revenue?.churnRate}%</span>
            <span className="text-[10px] text-gray-400">Cancelled subscription ratio</span>
          </div>
          <div className="p-4 rounded-2xl bg-red-50 text-red-600">
            <XCircle size={24} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase">Global API Hits</span>
            <span className="text-2xl font-bold text-gray-950 block">{usage?.apiCalls.toLocaleString()}</span>
            <span className="text-[10px] text-gray-400">Platform api count volume</span>
          </div>
          <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600">
            <Activity size={24} />
          </div>
        </div>

      </div>

      {/* Revenue growth charts */}
      <div className="grid md:grid-cols-2 gap-8">
        
        <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <h3 className="font-bold text-base text-gray-900">MRR Revenue Curve</h3>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenue?.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="month" tickLine={false} stroke="#9ca3af" />
                <YAxis tickLine={false} stroke="#9ca3af" />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                <Line type="monotone" dataKey="mrr" stroke="#6366F1" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <h3 className="font-bold text-base text-gray-900">Platform API Consumption</h3>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usage?.usageTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" tickLine={false} stroke="#9ca3af" />
                <YAxis tickLine={false} stroke="#9ca3af" />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                <Bar dataKey="apiCalls" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Active tenant table */}
      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm flex flex-col">
        
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-lg text-gray-950">Tenant Directory</h3>
            <p className="text-xs text-gray-400">Total registered subdomains on the platform.</p>
          </div>
          
          {/* Search box */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search company or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-gray-50/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 uppercase">
              <tr>
                <th className="py-3 px-6">Company</th>
                <th className="py-3 px-6">Subdomain</th>
                <th className="py-3 px-6">Active Plan</th>
                <th className="py-3 px-6">Onboarded</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50">
                  <td className="py-3 px-6">
                    <div>
                      <span className="font-semibold text-gray-900 block">{t.company_name}</span>
                      <span className="text-gray-400 text-[10px]">{t.owner_email}</span>
                    </div>
                  </td>
                  <td className="py-3 px-6 font-mono text-[11px] text-gray-900">{t.subdomain}</td>
                  <td className="py-3 px-6 font-semibold text-gray-800">
                    {t.plan?.name || 'Starter'} (${parseFloat(t.plan?.price_monthly || '29').toFixed(0)}/mo)
                  </td>
                  <td className="py-3 px-6">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="py-3 px-6">
                    <span className={`py-0.5 px-2 rounded-full text-[10px] font-semibold ${
                      t.status === 'active' 
                        ? 'bg-green-50 text-green-700' 
                        : t.status === 'suspended' 
                          ? 'bg-red-50 text-red-700' 
                          : 'bg-gray-50 text-gray-700'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-right space-x-2">
                    {t.status === 'suspended' ? (
                      <button 
                        onClick={() => handleReactivate(t.id)}
                        className="py-1 px-3 bg-green-50 text-green-700 hover:bg-green-100 font-semibold rounded-lg transition"
                      >
                        Reactivate
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleSuspend(t.id)}
                        className="py-1 px-3 bg-red-50 text-red-600 hover:bg-red-100 font-semibold rounded-lg transition"
                      >
                        Suspend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <button 
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-xs font-semibold"
            >
              Previous
            </button>
            <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
            <button 
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-xs font-semibold"
            >
              Next
            </button>
          </div>
        )}

      </div>

    </div>
  );
};
