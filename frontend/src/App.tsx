import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TenantProvider, useTenant } from './context/TenantContext';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Login, ForgotPassword, ResetPassword } from './pages/Login';
import { Signup } from './pages/Signup';
import { ProvisioningProgress } from './pages/ProvisioningProgress';
import { Dashboard } from './pages/Dashboard';
import { Billing } from './pages/Billing';
import { ApiKeys } from './pages/ApiKeys';
import { Team } from './pages/Team';
import { Usage } from './pages/Usage';
import { Settings } from './pages/Settings';
import { AdminPanel } from './pages/AdminPanel';
import { Toaster } from 'react-hot-toast';

// Route wrapper enforcing authentication sessions
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin mx-auto"></div>
          <span className="text-xs text-gray-400 font-semibold block">Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Route wrapper validating tenant subdomains
const OnboardingRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <TenantProvider>
        <AuthProvider>
          <Routes>
            {/* Public Landing & Marketing */}
            <Route path="/" element={<Landing />} />
            
            {/* Onboarding & Provisioning Stepper */}
            <Route path="/signup" element={<Signup />} />
            <Route path="/provisioning-progress/:tenantId" element={<ProvisioningProgress />} />
            
            {/* Authentications */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Authenticated Workspace Tiers */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/billing" 
              element={
                <ProtectedRoute>
                  <Billing />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/keys" 
              element={
                <ProtectedRoute allowedRoles={['owner', 'admin']}>
                  <ApiKeys />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/team" 
              element={
                <ProtectedRoute>
                  <Team />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/usage" 
              element={
                <ProtectedRoute>
                  <Usage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />

            {/* System Superadmin Panel */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <AdminPanel />
                </ProtectedRoute>
              } 
            />

            {/* Redirect fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="top-right" toastOptions={{ duration: 3000, style: { fontFamily: 'Outfit, sans-serif' } }} />
        </AuthProvider>
      </TenantProvider>
    </BrowserRouter>
  );
};
export default App;
