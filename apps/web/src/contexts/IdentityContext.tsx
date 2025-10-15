import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface Identity {
  id: number;
  type: 'user' | 'company';
  userId?: string;
  companyId?: number;
  displayName: string;
  description?: string;
  createdAt: Date;
  updatedAt?: Date;
  // For company identities
  role?: string;
  canManageAgents?: boolean;
  canManageProjects?: boolean;
  canManageTasks?: boolean;
}

interface IdentityPermissions {
  canManageAgents: boolean;
  canManageProjects: boolean;
  canManageTasks: boolean;
  role: string;
}

interface IdentityContextType {
  // Current identity
  currentIdentity: Identity | null;
  currentPermissions: IdentityPermissions | null;

  // All accessible identities
  personalIdentity: Identity | null;
  companyIdentities: Identity[];
  allIdentities: Identity[];

  // Actions
  switchIdentity: (identityId: number) => Promise<void>;
  refreshIdentities: () => Promise<void>;

  // Loading states
  isLoading: boolean;
  isSwitching: boolean;
}

const IdentityContext = createContext<IdentityContextType | undefined>(undefined);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  const [currentIdentity, setCurrentIdentity] = useState<Identity | null>(null);
  const [currentPermissions, setCurrentPermissions] = useState<IdentityPermissions | null>(null);
  const [personalIdentity, setPersonalIdentity] = useState<Identity | null>(null);
  const [companyIdentities, setCompanyIdentities] = useState<Identity[]>([]);
  const [allIdentities, setAllIdentities] = useState<Identity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  // Fetch all accessible identities
  const fetchIdentities = async () => {
    try {
      const response = await fetch('/api/identities', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch identities');
      }

      const data = await response.json();

      setPersonalIdentity(data.personal || null);
      setCompanyIdentities(data.companies || []);
      setAllIdentities(data.all || []);

      return data;
    } catch (error) {
      console.error('Error fetching identities:', error);
      return null;
    }
  };

  // Fetch current identity
  const fetchCurrentIdentity = async () => {
    try {
      const response = await fetch('/api/identities/current', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch current identity');
      }

      const data = await response.json();

      setCurrentIdentity(data.identity);
      setCurrentPermissions(data.permissions);

      return data;
    } catch (error) {
      console.error('Error fetching current identity:', error);
      return null;
    }
  };

  // Initialize identities when user logs in
  useEffect(() => {
    if (isAuthenticated && user) {
      setIsLoading(true);
      Promise.all([
        fetchIdentities(),
        fetchCurrentIdentity(),
      ]).finally(() => {
        setIsLoading(false);
      });
    } else {
      // Clear identities when user logs out
      setCurrentIdentity(null);
      setCurrentPermissions(null);
      setPersonalIdentity(null);
      setCompanyIdentities([]);
      setAllIdentities([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  // Switch identity
  const switchIdentity = async (identityId: number) => {
    setIsSwitching(true);
    try {
      const response = await fetch(`/api/identities/switch/${identityId}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to switch identity');
      }

      const data = await response.json();
      setCurrentIdentity(data.identity);
      setCurrentPermissions(data.permissions);

      // Trigger a page refresh or emit an event to refresh data
      window.dispatchEvent(new CustomEvent('identity-changed', {
        detail: { identity: data.identity }
      }));
    } catch (error) {
      console.error('Error switching identity:', error);
      throw error;
    } finally {
      setIsSwitching(false);
    }
  };

  // Refresh identities (useful after creating new company or changing permissions)
  const refreshIdentities = async () => {
    await Promise.all([
      fetchIdentities(),
      fetchCurrentIdentity(),
    ]);
  };

  const value: IdentityContextType = {
    currentIdentity,
    currentPermissions,
    personalIdentity,
    companyIdentities,
    allIdentities,
    switchIdentity,
    refreshIdentities,
    isLoading,
    isSwitching,
  };

  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  const context = useContext(IdentityContext);
  if (context === undefined) {
    throw new Error('useIdentity must be used within an IdentityProvider');
  }
  return context;
}