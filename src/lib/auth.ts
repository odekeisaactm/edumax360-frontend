import { User } from './types';

// Token management
export const tokenManager = {
  /**
   * Get the access token from localStorage
   */
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  },

  /**
   * Get the refresh token from localStorage
   */
  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refresh_token');
  },

  /**
   * Set both tokens in localStorage
   */
  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  },

  /**
   * Clear all tokens from localStorage
   */
  clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  /**
   * Check if access token exists and is not expired
   */
  isTokenValid(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;

    try {
      // Decode JWT token (simple decode without verification)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;

      // Check if token is expired (with 5-minute buffer)
      return payload.exp > currentTime + 300;
    } catch {
      return false;
    }
  },

  /**
   * Get token expiration time
   */
  getTokenExpiration(): Date | null {
    const token = this.getAccessToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return new Date(payload.exp * 1000);
    } catch {
      return null;
    }
  },
};

// User data management
export const userManager = {
  /**
   * Get current user from localStorage
   */
  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('current_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  /**
   * Set current user in localStorage
   */
  setCurrentUser(user: User): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('current_user', JSON.stringify(user));
  },

  /**
   * Clear current user from localStorage
   */
  clearCurrentUser(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('current_user');
  },

  /**
   * Get user permissions from localStorage
   */
  getUserPermissions(): string[] {
    if (typeof window === 'undefined') return [];
    const permissions = localStorage.getItem('user_permissions');
    return permissions ? JSON.parse(permissions) : [];
  },

  /**
   * Set user permissions in localStorage
   */
  setUserPermissions(permissions: string[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('user_permissions', JSON.stringify(permissions));
  },

  /**
   * Clear user permissions from localStorage
   */
  clearUserPermissions(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('user_permissions');
  },

  /**
   * Get active modules from localStorage
   */
  getActiveModules(): any[] {
    if (typeof window === 'undefined') return [];
    const modules = localStorage.getItem('active_modules');
    return modules ? JSON.parse(modules) : [];
  },

  /**
   * Set active modules in localStorage
   */
  setActiveModules(modules: any[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('active_modules', JSON.stringify(modules));
  },

  /**
   * Clear active modules from localStorage
   */
  clearActiveModules(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('active_modules');
  },
};

// Authentication helpers
export const authHelpers = {
  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return tokenManager.isTokenValid() && !!userManager.getCurrentUser();
  },

  /**
   * Check if user has specific permission
   */
  hasPermission(permission: string): boolean {
    const permissions = userManager.getUserPermissions();
    return permissions.includes(permission);
  },

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(permissions: string[]): boolean {
    const userPermissions = userManager.getUserPermissions();
    return permissions.some(permission => userPermissions.includes(permission));
  },

  /**
   * Check if user has all specified permissions
   */
  hasAllPermissions(permissions: string[]): boolean {
    const userPermissions = userManager.getUserPermissions();
    return permissions.every(permission => userPermissions.includes(permission));
  },

  /**
   * Check if user is of specific type
   */
  isUserType(userType: 'staff' | 'student' | 'parent'): boolean {
    const user = userManager.getCurrentUser();
    return user?.user_type === userType;
  },

  /**
   * Check if user is staff
   */
  isStaff(): boolean {
    return this.isUserType('staff');
  },

  /**
   * Check if user is student
   */
  isStudent(): boolean {
    return this.isUserType('student');
  },

  /**
   * Check if user is parent
   */
  isParent(): boolean {
    return this.isUserType('parent');
  },

  /**
   * Check if module is active for the school
   */
  isModuleActive(moduleCode: string): boolean {
    const activeModules = userManager.getActiveModules();
    return activeModules.some((module: any) => module.code === moduleCode);
  },

  /**
   * Get user's full name
   */
  getUserFullName(): string {
    const user = userManager.getCurrentUser();
    if (!user) return '';
    return `${user.first_name} ${user.last_name}`.trim();
  },

  /**
   * Get user's display name
   */
  getUserDisplayName(): string {
    const user = userManager.getCurrentUser();
    if (!user) return '';
    return user.first_name || user.username;
  },

  /**
   * Check if authentication is about to expire (within 5 minutes)
   */
  isAuthExpiringSoon(): boolean {
    const expiration = tokenManager.getTokenExpiration();
    if (!expiration) return true;

    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return expiration < fiveMinutesFromNow;
  },

  /**
   * Get the time until token expires in minutes
   */
  getTimeUntilExpiration(): number {
    const expiration = tokenManager.getTokenExpiration();
    if (!expiration) return 0;

    const now = new Date();
    const diffMs = expiration.getTime() - now.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60)));
  },
};

// Session management
export const sessionManager = {
  /**
   * Initialize session from localStorage
   */
  initializeSession(): {
    user: User | null;
    isAuthenticated: boolean;
    permissions: string[];
    activeModules: any[];
  } {
    const user = userManager.getCurrentUser();
    const isAuthenticated = authHelpers.isAuthenticated();
    const permissions = userManager.getUserPermissions();
    const activeModules = userManager.getActiveModules();

    return {
      user,
      isAuthenticated,
      permissions,
      activeModules,
    };
  },

  /**
   * Clear all session data
   */
  clearSession(): void {
    tokenManager.clearTokens();
    userManager.clearCurrentUser();
    userManager.clearUserPermissions();
    userManager.clearActiveModules();
  },

  /**
   * Save session data after successful login
   */
  saveSession(
    user: User,
    accessToken: string,
    refreshToken: string,
    permissions: string[],
    activeModules: any[]
  ): void {
    tokenManager.setTokens(accessToken, refreshToken);
    userManager.setCurrentUser(user);
    userManager.setUserPermissions(permissions);
    userManager.setActiveModules(activeModules);
  },
};

// Export default for convenience
export default {
  tokenManager,
  userManager,
  authHelpers,
  sessionManager,
};