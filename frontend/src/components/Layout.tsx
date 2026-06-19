import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { 
  LayoutDashboard, 
  CreditCard, 
  Key, 
  Users, 
  BarChart3, 
  Settings, 
  ShieldAlert, 
  LogOut,
  Menu,
  X,
  Building2
} from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, tenant, logout } = useAuth();
  const { tenantSlug, clearTenantOverride } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSuperadmin = user?.role === 'superadmin';

  const menuItems = isSuperadmin 
    ? [
        { name: 'Superadmin Panel', path: '/admin', icon: ShieldAlert }
      ]
    : [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Billing & Sub', path: '/billing', icon: CreditCard },
        { name: 'API Keys', path: '/keys', icon: Key },
        { name: 'Team Members', path: '/team', icon: Users },
        { name: 'Usage & Analytics', path: '/usage', icon: BarChart3 },
        { name: 'Settings', path: '/settings', icon: Settings }
      ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 text-gray-900 font-sans">
      
      {/* Mobile Header */}
      <header className="flex md:hidden items-center justify-between bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <Building2 size={20} />
          </div>
          <span className="font-bold text-lg text-indigo-600">
            {isSuperadmin ? 'Platform Admin' : tenant?.companyName || 'SaaS Portal'}
          </span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
          className="text-gray-500 hover:text-indigo-600 transition"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar - Desktop and Mobile Overlay */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col justify-between transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-auto md:h-screen
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Logo / Org Header */}
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-md shadow-indigo-100">
                <Building2 size={22} />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 leading-tight">
                  {isSuperadmin ? 'Superadmin' : tenant?.companyName || 'SaaS Portal'}
                </span>
                {!isSuperadmin && tenantSlug && (
                  <span className="text-xs text-indigo-500 font-medium mt-0.5">{tenantSlug}.saas-billing-rajbi.com</span>
                )}
              </div>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-gray-400 hover:text-indigo-600">
              <X size={20} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 flex-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200
                    ${isActive 
                      ? 'bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-50/50' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
                  `}
                >
                  <Icon size={18} className={isActive ? 'text-indigo-600' : 'text-gray-400'} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer profile & logout */}
        <div className="p-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold shadow-inner">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-gray-900 truncate">{user?.name || user?.email}</span>
              <span className="text-xs text-gray-400 truncate capitalize">{user?.role}</span>
            </div>
          </div>

          <div className="flex gap-2">
            {/* If developer override is active, show clear button */}
            {localStorage.getItem('tenant_slug') && (
              <button 
                onClick={clearTenantOverride}
                className="flex-1 py-2 px-3 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition"
                title="Reset Tenant subdomain"
              >
                Reset Tenant
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold transition"
            >
              <LogOut size={13} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 overflow-y-auto h-screen p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
