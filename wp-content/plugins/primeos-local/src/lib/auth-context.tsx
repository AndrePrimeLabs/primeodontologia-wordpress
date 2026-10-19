import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { apiHttpClient } from '@/api/primeosClient';
import { supabase } from '@/lib/supabase-client';

export type UserRole = 'admin' | 'gestor' | 'dentista' | 'recepcao' | 'guest';

export interface PrimeUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenant_id?: string;
}

interface AuthContextType {
  user: PrimeUser | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  authError: { type: string; message: string } | null;
  appPublicSettings: any;
  hasRole: (allowedRoles: UserRole | UserRole[]) => boolean;
  logout: (shouldRedirect?: boolean) => Promise<void>;
  navigateToLogin: () => void;
  checkAppState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<PrimeUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isLoadingPublicSettings] = useState<boolean>(false);
  const [authError, setAuthError] = useState<{ type: string; message: string } | null>(null);
  const [appPublicSettings] = useState({
    id: 'primeos.primeodontologia.com.br',
    public_settings: {}
  });

  const syncUserFromSession = useCallback((session: any) => {
    if (!session?.user) {
      // Check for local guest/demo mode without admin escalation
      const isAuthFlag = typeof localStorage !== 'undefined' && localStorage.getItem('primeos_auth') === '1';
      const storedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('primeos_user') : null;

      if (isAuthFlag && storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          const safeRole: UserRole = parsed.role === 'admin' ? 'admin' : (parsed.role || 'guest');
          setUser({
            id: parsed.id || 'demo_user',
            email: parsed.email || 'demo@primeos.local',
            name: parsed.name || 'Usuário PrimeOS',
            role: safeRole,
            tenant_id: parsed.tenant_id
          });
          setIsAuthenticated(true);
          return;
        } catch {
          // invalid json in localStorage
        }
      }

      setUser(null);
      setIsAuthenticated(false);
      delete apiHttpClient.defaults.headers.common['Authorization'];
      return;
    }

    const { user: authUser, access_token } = session;
    const metadata = authUser.user_metadata || {};
    const appMetadata = authUser.app_metadata || {};

    const resolvedRole: UserRole = (appMetadata.role || metadata.role || 'dentista').toLowerCase();

    const primeUser: PrimeUser = {
      id: authUser.id,
      email: authUser.email || '',
      name: metadata.full_name || metadata.name || authUser.email?.split('@')[0] || 'Usuário',
      role: resolvedRole,
      tenant_id: metadata.tenant_id || appMetadata.tenant_id
    };

    setUser(primeUser);
    setIsAuthenticated(true);

    if (access_token) {
      apiHttpClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      try {
        localStorage.setItem('primeos_token', access_token);
        localStorage.setItem('primeos_auth', '1');
        localStorage.setItem('primeos_user', JSON.stringify(primeUser));
      } catch {}
    }
  }, []);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      // 1. Verify active Supabase session
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      syncUserFromSession(session);
    } catch (error: any) {
      console.warn('Supabase session check error:', error?.message || error);
      // Fallback verification from local state if Supabase server is offline
      syncUserFromSession(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, [syncUserFromSession]);

  useEffect(() => {
    checkUserAuth();

    // 2. Subscribe to auth state changes (token refresh, sign out, sign in)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUserFromSession(session);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [checkUserAuth, syncUserFromSession]);

  const hasRole = useCallback((allowedRoles: UserRole | UserRole[]) => {
    if (!user) return false;
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return rolesArray.includes(user.role);
  }, [user]);

  const logout = async (shouldRedirect = true) => {
    try {
      // 1. Sign out from Supabase
      try {
        await supabase.auth.signOut();
      } catch {}

      // 2. Clear state tokens from localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('primeos_user');
        localStorage.removeItem('primeos_token');
        localStorage.removeItem('primeos_auth');
      }

      // 3. Clear auth headers from Axios
      delete apiHttpClient.defaults.headers.common['Authorization'];

      setUser(null);
      setIsAuthenticated(false);

      if (shouldRedirect) {
        window.location.href = '/login.html';
      }
    } catch (error: any) {
      console.error('Logout error:', error);
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login.html';
  };

  return (
    <AuthContext.Provider value={{
      user,
      role: user?.role || 'guest',
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      hasRole,
      logout,
      navigateToLogin,
      checkAppState: checkUserAuth,
    }}>
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

export default AuthProvider;
