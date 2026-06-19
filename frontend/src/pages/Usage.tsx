import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  Legend
} from 'recharts';
import { BarChart3, Terminal, TrendingUp, Cpu, ServerCrash, Clock } from 'lucide-react';

interface EndpointUsage {
  endpoint: string;
  count: number;
  avgResponseTime: string | number;
}

interface DailyUsage {
  date: string;
  count: number;
}

interface UsageHistory {
  date: string;
  count: number;
  storage: number;
}

export const Usage: React.FC = () => {
  const [endpoints, setEndpoints] = useState<EndpointUsage[]>([]);
  const [dailyCalls, setDailyCalls] = useState<DailyUsage[]>([]);
  const [history, setHistory] = useState<UsageHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsageData = async () => {
    try {
      const [breakdownRes, historyRes] = await Promise.all([
        api.get('/usage/breakdown'),
        api.get('/usage/history')
      ]);
      
      setEndpoints(breakdownRes.data.byEndpoint || []);
      setDailyCalls(breakdownRes.data.byDay || []);
      setHistory(historyRes.data.metrics || []);
    } catch (error) {
      console.error('Failed to retrieve usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-gray-200 rounded-lg w-1/4"></div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="h-80 bg-gray-200 rounded-3xl"></div>
          <div className="h-80 bg-gray-200 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  // Fallbacks for charts if empty
  const defaultChartData = dailyCalls.length > 0 ? dailyCalls : [
    { date: 'Mon', count: 0 },
    { date: 'Tue', count: 0 },
    { date: 'Wed', count: 0 }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">Usage & Analytics</h1>
        <p className="text-sm text-gray-400 mt-1">Trace resource traffic spikes, latency bottlenecks, and storage limits.</p>
      </div>

      {/* Recharts Grid */}
      <div className="grid md:grid-cols-2 gap-8">
        
        {/* Daily Hits Histograms */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-600" />
            <h3 className="font-bold text-base text-gray-900">API Hits per Day</h3>
          </div>
          <div className="h-72 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={defaultChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" tickLine={false} stroke="#9ca3af" />
                <YAxis tickLine={false} stroke="#9ca3af" />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                <Bar dataKey="count" fill="#6366F1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Storage Volume Trends */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-600" />
            <h3 className="font-bold text-base text-gray-900">Storage Consumption Trend</h3>
          </div>
          <div className="h-72 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" tickLine={false} stroke="#9ca3af" />
                <YAxis tickLine={false} stroke="#9ca3af" />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                <Line type="monotone" dataKey="storage" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Latency & Hit Rate by Endpoint */}
      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-bold text-lg text-gray-950">Endpoint Distribution</h3>
            <p className="text-xs text-gray-400">Total hit quantities and latency response breakdowns.</p>
          </div>
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 py-1 px-3 rounded-full flex items-center gap-1">
            <Clock size={12} /> Response stats cached
          </span>
        </div>

        {endpoints.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-16">No API hits recorded in current billing cycle.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 uppercase">
                <tr>
                  <th className="py-3 px-6">Endpoint URI</th>
                  <th className="py-3 px-6">Hits Billed</th>
                  <th className="py-3 px-6">Avg Latency</th>
                  <th className="py-3 px-6">Status Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                {endpoints.map((ep, index) => (
                  <tr key={index} className="hover:bg-gray-50/50">
                    <td className="py-3 px-6 font-mono text-[11px] text-gray-900">{ep.endpoint}</td>
                    <td className="py-3 px-6 font-semibold text-gray-950">{ep.count.toLocaleString()}</td>
                    <td className="py-3 px-6 flex items-center gap-1.5 py-4">
                      <Clock size={12} className="text-gray-400" />
                      <span>{parseFloat(String(ep.avgResponseTime)).toFixed(1)} ms</span>
                    </td>
                    <td className="py-3 px-6">
                      <span className="inline-flex items-center gap-1 py-0.5 px-2 rounded-full text-[10px] bg-green-50 text-green-700 font-semibold">
                        99.8% OK
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
