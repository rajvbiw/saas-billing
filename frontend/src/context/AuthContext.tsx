import React, { createContext, useState, useEffect, useContext } from 'react';
import { api } from '../services/api';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'superadmin';
  lastLogin?: string;
}

interface Tenant {
  id: number;
  companyName: string;
  slug: string;
  subdomain: string;
  stripe_subdomain?: string;
  status: 'trialing' | 'active' | 'suspended' | 'cancelled';
  plan?: {
    id: number;
    name: string;
    max_users: number;
    max_api_calls_per_month: number;
    max_storage_gb: number;
  };
}

interface AuthContextProps {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (data: any) => Promise<any>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setTenant(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      if (res.data.tenant) {
        setTenant(res.data.tenant);
      }
    } catch (error) {
      console.error('Error fetching session details:', error);
      // Clean tokens if session invalid
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, refreshToken, user: loggedUser } = res.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(loggedUser);
      await refreshUser();
      return res.data;
    } catch (error: any) {
      setIsLoading(false);
      throw error.response?.data || { error: 'Login connection error' };
    }
  };

  const register = async (data: any) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/register', data);
      setIsLoading(false);
      return res.data;
    } catch (error: any) {
      setIsLoading(false);
      throw error.response?.data || { error: 'Registration error' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setTenant(null);
    setIsLoading(false);
    window.location.href = '/login';
  };

  const isAuthenticated = user !== null;

  return (
    <AuthContext.Provider value={{ user, tenant, isAuthenticated, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
