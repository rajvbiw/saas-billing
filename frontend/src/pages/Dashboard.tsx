import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { io } from 'socket.io-client';
import { 
  Users, 
  Terminal, 
  HardDrive, 
  Calendar, 
  ArrowUpRight, 
  Activity,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardData {
  users_count: number;
  api_calls_this_month: number;
  storage_used_gb: number;
  plan_limits: {
    max_users: number;
    max_api_calls: number;
    max_storage: number;
  };
  days_until_renewal: number;
  recent_activity: any[];
}

export const Dashboard: React.FC = () => {
  const { tenant } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Fetch initial statistics
  const fetchStats = async () => {
    try {
      const res = await api.get('/dashboard/overview');
      setData(res.data);
    } catch (err: any) {
      toast.error('Failed to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // 2. Setup Socket.io client for real-time usage increments
  useEffect(() => {
    if (!tenant) return;

    // Connect to backend port 5000 (standard server running Socket.io)
    const socket = io('http://localhost:5000');

    socket.on('connect', () => {
      // Join tenant room
      socket.emit('join_tenant', tenant.id);
    });

    socket.on('usage_update', (payload: { metric: string; current: number }) => {
      setData((prev) => {
        if (!prev) return null;
        if (payload.metric === 'api_calls') {
          return { ...prev, api_calls_this_month: payload.current };
        } else if (payload.metric === 'storage_gb') {
          return { ...prev, storage_used_gb: payload.current };
        }
        return prev;
      });
    });

    socket.on('subscription_updated', () => {
      fetchStats();
      toast.success('Your subscription plan was updated! Reloading parameters...');
    });

    socket.on('tenant_suspended', () => {
      window.location.reload();
    });

    return () => {
      socket.disconnect();
    };
  }, [tenant]);

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
        <div className="grid md:grid-cols-3 gap-6">
          <div className="h-96 bg-gray-200 rounded-3xl md:col-span-2"></div>
          <div className="h-96 bg-gray-200 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Gauge calculations
  const calculatePercentage = (current: number, max: number) => {
    return Math.min(Math.round((current / max) * 100), 100);
  };

  const usersPercent = calculatePercentage(data.users_count, data.plan_limits.max_users);
  const apiPercent = calculatePercentage(data.api_calls_this_month, data.plan_limits.max_api_calls);
  const storagePercent = calculatePercentage(data.storage_used_gb, data.plan_limits.max_storage);

  // SVG Gauge constants
  const radius = 35;
  const circumference = 2 * Math.PI * radius;

  const getStrokeOffset = (percent: number) => {
    return circumference - (percent / 100) * circumference;
  };

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-950">Workspace Overview</h1>
          <p className="text-sm text-gray-400 mt-1">Real-time subscription usage metrics for {tenant?.companyName}.</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl py-2 px-4 flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></div>
          <span className="text-xs font-semibold text-indigo-700">Subscribed to: {tenant?.plan?.name || 'Pro'} Tier</span>
        </div>
      </div>

      {/* Primary Cards Grid */}
      <div className="grid md:grid-cols-4 gap-6">
        
        {/* Renewal Countdown */}
        <div className="bg-white border border-gray-200 p-6 rounded-3xl flex items-center justify-between hover:shadow-md transition">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase">Renewal In</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-950">{data.days_until_renewal}</span>
              <span className="text-gray-400 text-xs font-medium">Days</span>
            </div>
            <span className="text-[10px] text-gray-400 block">Autopay active via card</span>
          </div>
          <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600">
            <Calendar size={24} />
          </div>
        </div>

        {/* Users Seats circular dial */}
        <div className="bg-white border border-gray-200 p-6 rounded-3xl flex items-center justify-between hover:shadow-md transition">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase font-sans">Active Users</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-950">{data.users_count}</span>
              <span className="text-gray-400 text-xs">/ {data.plan_limits.max_users} max</span>
            </div>
            <span className="text-[10px] text-gray-400 block">{usersPercent}% seat volume used</span>
          </div>
          
          {/* Circular Gauge */}
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="32" cy="32" r={radius} className="text-gray-100" strokeWidth="6" stroke="currentColor" fill="transparent" />
              <circle 
                cx="32" 
                cy="32" 
                r={radius} 
                className="text-indigo-600 transition-all duration-500" 
                strokeWidth="6" 
                strokeDasharray={circumference}
                strokeDashoffset={getStrokeOffset(usersPercent)}
                strokeLinecap="round"
                stroke="currentColor" 
                fill="transparent" 
              />
            </svg>
            <span className="absolute text-[10px] font-bold text-gray-900">{usersPercent}%</span>
          </div>
        </div>

        {/* API Calls circular dial */}
        <div className="bg-white border border-gray-200 p-6 rounded-3xl flex items-center justify-between hover:shadow-md transition">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase">API Calls / mo</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-950">
                {data.api_calls_this_month.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 block">Limit: {data.plan_limits.max_api_calls.toLocaleString()}</span>
          </div>

          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="32" cy="32" r={radius} className="text-gray-100" strokeWidth="6" stroke="currentColor" fill="transparent" />
              <circle 
                cx="32" 
                cy="32" 
                r={radius} 
                className="text-indigo-600 transition-all duration-500" 
                strokeWidth="6" 
                strokeDasharray={circumference}
                strokeDashoffset={getStrokeOffset(apiPercent)}
                strokeLinecap="round"
                stroke="currentColor" 
                fill="transparent" 
              />
            </svg>
            <span className="absolute text-[10px] font-bold text-gray-900">{apiPercent}%</span>
          </div>
        </div>

        {/* Storage Volume circular dial */}
        <div className="bg-white border border-gray-200 p-6 rounded-3xl flex items-center justify-between hover:shadow-md transition">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase">Storage Used</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-950">{data.storage_used_gb}</span>
              <span className="text-gray-400 text-xs">/ {data.plan_limits.max_storage} GB</span>
            </div>
            <span className="text-[10px] text-gray-400 block">{storagePercent}% cloud space used</span>
          </div>

          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="32" cy="32" r={radius} className="text-gray-100" strokeWidth="6" stroke="currentColor" fill="transparent" />
              <circle 
                cx="32" 
                cy="32" 
                r={radius} 
                className="text-indigo-600 transition-all duration-500" 
                strokeWidth="6" 
                strokeDasharray={circumference}
                strokeDashoffset={getStrokeOffset(storagePercent)}
                strokeLinecap="round"
                stroke="currentColor" 
                fill="transparent" 
              />
            </svg>
            <span className="absolute text-[10px] font-bold text-gray-900">{storagePercent}%</span>
          </div>
        </div>

      </div>

      {/* Main Grid: Live Analytics vs Activity */}
      <div className="grid md:grid-cols-3 gap-6">
        
        {/* Left Side: API Usage status check */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 md:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-gray-950">Metered API Consumption</h3>
              <p className="text-xs text-gray-400">Total monthly hits on resource gateways.</p>
            </div>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 py-1 px-3 rounded-full flex items-center gap-1.5">
              <Activity size={12} /> Live Socket Stream Active
            </span>
          </div>

          {/* Quick instructions check */}
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex gap-3 text-xs text-gray-500 leading-relaxed">
            <AlertCircle className="text-indigo-600 shrink-0 mt-0.5" size={16} />
            <p>
              Your API metrics are parsed in real time via our WebSocket listeners. If you exceed your plan's monthly limits, API endpoints will respond with `429 Too Many Requests` status codes. Upgrade your tier in the billing card below to bump boundaries.
            </p>
          </div>

          {/* Graphical display */}
          <div className="h-64 flex items-center justify-center bg-gray-50/50 border border-dashed border-gray-200 rounded-2xl">
            <div className="text-center space-y-2">
              <Terminal className="mx-auto text-indigo-500" size={32} />
              <span className="text-xs font-semibold text-gray-900 block">Real-time Sockets listening...</span>
              <span className="text-[11px] text-gray-400 block max-w-xs mx-auto">
                Execute client API calls to watch the circular gauges update dynamically without refreshing.
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Activity Log Feed */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="font-bold text-lg text-gray-950">Workspace Audit Trail</h3>
            <p className="text-xs text-gray-400">Chronological history of administration actions.</p>
          </div>

          <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
            {data.recent_activity.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-12">No administration activities recorded.</p>
            ) : (
              data.recent_activity.map((act) => (
                <div key={act.id} className="flex gap-3 text-xs border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-gray-600 font-bold">
                    {act.user?.name?.charAt(0) || 'A'}
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-900 leading-tight">
                      <strong>{act.user?.name || 'Admin'}</strong> did <span className="font-mono text-[11px] bg-gray-100 py-0.5 px-1.5 rounded">{act.action}</span> on {act.resource}
                    </p>
                    <span className="text-[10px] text-gray-400 block">
                      {new Date(act.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
