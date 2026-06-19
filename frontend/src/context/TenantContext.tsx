import React, { createContext, useState, useEffect, useContext } from 'react';
import { getSubdomain, clearSubdomainOverride } from '../utils/subdomainDetect';

interface TenantContextProps {
  tenantSlug: string | null;
  hasTenantContext: boolean;
  setTenantOverride: (slug: string) => void;
  clearTenantOverride: () => void;
}

const TenantContext = createContext<TenantContextProps | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenantSlug, setTenantSlug] = useState<string | null>(getSubdomain());

  useEffect(() => {
    // Keep tenant slug synced on load
    setTenantSlug(getSubdomain());
  }, []);

  const setTenantOverride = (slug: string) => {
    localStorage.setItem('tenant_slug', slug);
    setTenantSlug(slug);
    // Reload page to re-trigger Axios interceptor mappings
    window.location.reload();
  };

  const clearTenantOverride = () => {
    clearSubdomainOverride();
    setTenantSlug(null);
    window.location.reload();
  };

  const hasTenantContext = tenantSlug !== null;

  return (
    <TenantContext.Provider value={{ tenantSlug, hasTenantContext, setTenantOverride, clearTenantOverride }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
