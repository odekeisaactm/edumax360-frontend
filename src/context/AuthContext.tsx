'use client';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Module, AuthContextType } from '@/lib/types';
import { authAPI, schoolInfoAPI } from '@/lib/api';
import { tokenManager, sessionManager, authHelpers, userManager } from '@/lib/auth';
import { useRouter } from 'next/navigation';

// ─── School info cache helpers ────────────────────────────────────────────────
// Stored in localStorage so it survives page refresh without an extra API call.
// Updated only when school info is saved (call refreshSchoolInfo() after saving).
const SCHOOL_INFO_KEY = 'school_info_cache';

function getCachedSchoolInfo(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SCHOOL_INFO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedSchoolInfo(info: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SCHOOL_INFO_KEY, JSON.stringify(info));
  } catch {}
}

function clearCachedSchoolInfo() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SCHOOL_INFO_KEY);
}

// ─── Extended AuthContextType ─────────────────────────────────────────────────
// Add schoolInfo and refreshSchoolInfo to the existing type.
// Since we can't edit the types file here, we extend inline.
interface ExtendedAuthContextType extends AuthContextType {
  schoolInfo: any | null;
  refreshSchoolInfo: () => Promise<void>;
}

const AuthContext = createContext<ExtendedAuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [activeModules, setActiveModules] = useState<Module[]>([]);

  // School info — loaded from cache immediately, refreshed from API once per session
  const [schoolInfo, setSchoolInfo] = useState<any | null>(getCachedSchoolInfo());

  // ── Initialize auth on mount ──────────────────────────────────────────────
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const session = sessionManager.initializeSession();
        setUser(session.user);
        setPermissions(session.permissions);
        setActiveModules(session.activeModules);
        setToken(tokenManager.getAccessToken());
        setAuthReady(true);

        if (!session.isAuthenticated && session.user) {
          console.warn('Session present but token considered invalid; will attempt background refresh.');
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        sessionManager.clearSession();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // ── Fetch school info once after auth is ready ────────────────────────────
  // Only hits the API if cache is empty or stale.
  // Uses a session flag so we don't refetch on every tab focus.
  useEffect(() => {
    if (!authReady || !token) return;

    const sessionFetchedKey = 'school_info_fetched_this_session';
    const alreadyFetched = sessionStorage.getItem(sessionFetchedKey);

    if (alreadyFetched && getCachedSchoolInfo()) {
      // Cache is warm and we already fetched this session — skip
      return;
    }

    schoolInfoAPI.get()
      .then((info) => {
        if (info) {
          setSchoolInfo(info);
          setCachedSchoolInfo(info);
          sessionStorage.setItem(sessionFetchedKey, '1');
        }
      })
      .catch(() => {
        // Silently fall back to cached value — network may be slow
      });
  }, [authReady, token]);

  // ── refreshSchoolInfo — call this after saving school info ────────────────
  const refreshSchoolInfo = async (): Promise<void> => {
    try {
      const info = await schoolInfoAPI.get();
      if (info) {
        setSchoolInfo(info);
        setCachedSchoolInfo(info);
      }
    } catch (error) {
      console.error('Error refreshing school info:', error);
    }
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (username: string, password: string): Promise<any> => {
    setLoading(true);
    try {
      const response = await authAPI.login({ username, password });
      sessionManager.saveSession(
        response.user,
        response.token,
        response.refresh,
        response.permissions,
        response.active_modules
      );
      setUser(response.user);
      setToken(response.token);
      setPermissions(response.permissions);
      setActiveModules(response.active_modules);

      // Clear session fetch flag so school info refreshes on next load
      sessionStorage.removeItem('school_info_fetched_this_session');

      return response;
    } catch (error: any) {
      sessionManager.clearSession();
      setUser(null);
      setToken(null);
      setPermissions([]);
      setActiveModules([]);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      sessionManager.clearSession();
      clearCachedSchoolInfo();
      sessionStorage.removeItem('school_info_fetched_this_session');
      setUser(null);
      setToken(null);
      setPermissions([]);
      setActiveModules([]);
      setSchoolInfo(null);
      setLoading(false);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  // ── Refresh permissions ───────────────────────────────────────────────────
  const refreshPermissions = async (): Promise<void> => {
    if (!token) return;
    try {
      const data = await authAPI.getPermissions();
      setPermissions(data.permissions);
      setActiveModules(data.active_modules);
      userManager.setUserPermissions(data.permissions);
      userManager.setActiveModules(data.active_modules);
    } catch (error) {
      console.error('Error refreshing permissions:', error);
    }
  };

  const hasPermission = (permission: string): boolean => permissions.includes(permission);
  const hasAnyPermission = (perms: string[]): boolean => perms.some(perm => permissions.includes(perm));
  const isUserType = (type: 'staff' | 'student' | 'parent'): boolean => user?.user_type === type;
  const isModuleActive = (moduleCode: string): boolean => activeModules.some(m => m.code === moduleCode);
  const getUserFullName = (): string => user ? `${user.first_name} ${user.last_name}`.trim() : '';
  const getUserDisplayName = (): string => user ? (user.first_name || user.username) : '';

  // ── Auto-refresh permissions every 24 hours ───────────────────────────────
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(refreshPermissions, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  // ── Auto-logout when token expires ───────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const checkExpiration = () => {
      if (authHelpers.isAuthExpiringSoon()) logout();
    };
    const interval = setInterval(checkExpiration, 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  const value: ExtendedAuthContextType = {
    user,
    token,
    login,
    logout,
    loading,
    authReady,
    permissions,
    activeModules,
    hasPermission,
    hasAnyPermission,
    isUserType,
    isModuleActive,
    getUserFullName,
    getUserDisplayName,
    refreshPermissions,
    schoolInfo,
    refreshSchoolInfo,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): ExtendedAuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ─── HOC and hooks (unchanged) ────────────────────────────────────────────────

export const withAuth = <P extends object>(
  Component: React.ComponentType<P>,
  requiredPermissions?: string[],
  requiredUserType?: 'staff' | 'student' | 'parent'
) => {
  const AuthenticatedComponent = (props: P) => {
    const router = useRouter();
    const { user, loading, authReady, hasPermission, isUserType } = useAuth();

    if (!authReady || loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!user) {
      if (typeof window !== 'undefined') router.replace('/login');
      return null;
    }

    if (requiredUserType && !isUserType(requiredUserType)) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      );
    }

    if (requiredPermissions && !hasPermission(requiredPermissions[0])) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
            <p className="text-gray-600">You don't have the required permissions to access this page.</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };

  AuthenticatedComponent.displayName = `withAuth(${Component.displayName || Component.name})`;
  return AuthenticatedComponent;
};

export const useRequireAuth = () => {
  const router = useRouter();
  const { user, loading, authReady } = useAuth();
  useEffect(() => {
    if (!authReady) return;
    if (!user) router.replace('/login');
  }, [authReady, user, router]);
  return { user, loading, authReady };
};

export const useRequireStaff = () => {
  const router = useRouter();
  const { user, loading, authReady, isUserType } = useAuth();
  useEffect(() => {
    if (!authReady) return;
    if (!user || !isUserType('staff')) router.replace('/login');
  }, [authReady, user, isUserType, router]);
  return { user, loading, authReady };
};

export const useRequirePermission = (permission: string) => {
  const router = useRouter();
  const { user, loading, authReady, hasPermission } = useAuth();
  useEffect(() => {
    if (!authReady) return;
    if (!user || !hasPermission(permission)) router.replace('/login');
  }, [authReady, user, hasPermission, permission, router]);
  return { user, loading, hasPermission: hasPermission(permission), authReady };
};