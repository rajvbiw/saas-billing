/**
 * Resolves the tenant subdomain slug from the current browser location.
 * Fallbacks to url queries ?tenant=xxx or localstorage overrides to assist local developers.
 */
export function getSubdomain(): string | null {
  const host = window.location.host;
  const parts = host.split('.');

  // If host is tenant.localhost:5173 (length 2), parts = ['tenant', 'localhost:5173']
  // If host is tenant.saas.example.com (length 4), parts = ['tenant', 'saas', 'example', 'com']
  if (parts.length > 1) {
    const possibleSlug = parts[0];
    const cleanSlug = possibleSlug.toLowerCase().trim();
    
    // Ignore root levels
    if (
      cleanSlug !== 'www' && 
      cleanSlug !== 'saas' && 
      !cleanSlug.includes('localhost') && 
      !cleanSlug.includes('127') &&
      !cleanSlug.includes('192')
    ) {
      return cleanSlug;
    }
  }

  // Developer fallbacks for smooth local verification
  const urlParams = new URLSearchParams(window.location.search);
  const urlTenant = urlParams.get('tenant');
  if (urlTenant) {
    localStorage.setItem('tenant_slug', urlTenant);
    return urlTenant;
  }

  const stored = localStorage.getItem('tenant_slug');
  if (stored) {
    return stored;
  }

  return null;
}

/**
 * Removes the developer tenant slug override.
 */
export function clearSubdomainOverride(): void {
  localStorage.removeItem('tenant_slug');
}
