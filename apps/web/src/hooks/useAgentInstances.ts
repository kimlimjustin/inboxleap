import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { apiRequest } from '@/lib/queryClient';

interface AgentInstance {
  id: number;
  companyId: number;
  agentType: string;
  instanceName: string;
  emailAddress: string;
  isActive: boolean;
  customization: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export const useAgentInstances = (agentType: string) => {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  // Fetch all instances for this agent type
  const { data: instances = [], isLoading, error } = useQuery({
    queryKey: ['agent-instances', selectedCompany?.id, 'individual', agentType],
    queryFn: async () => {
      try {
        let response;
        if (selectedCompany) {
          // Company mode - get company agent instances
          response = await (await apiRequest('GET', `/api/companies/${selectedCompany.id}/agent-emails`)).json();
          if (response.success) {
            return response.data.agentEmails.filter((email: AgentInstance) => 
              email.agentType === agentType && email.isActive
            ) as AgentInstance[];
          }
        } else {
          // Individual mode - get user agent instances
          response = await (await apiRequest('GET', '/api/user/agent-emails')).json();
          if (response.success) {
            const userInstances = response.data.agentEmails.filter((email: any) => 
              email.agentType === agentType && email.isActive
            );
            
            // Convert user agent emails to AgentInstance format
            return userInstances.map((email: any) => ({
              id: email.id,
              companyId: 0, // Individual mode
              agentType: email.agentType,
              instanceName: email.instanceName,
              emailAddress: email.emailAddress,
              isActive: email.isActive,
              customization: email.customization,
              createdAt: email.createdAt,
              updatedAt: email.updatedAt
            })) as AgentInstance[];
          }
        }
        return [];
      } catch (error) {
        console.error('Error fetching agent instances:', error);
        return [];
      }
    },
    enabled: !!agentType,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Auto-create default instance for individual users if none exists
  const ensureDefaultInstance = useMutation({
    mutationFn: async () => {
      if (selectedCompany) return null; // Only for individual mode
      
      const response = await apiRequest('POST', '/api/user/agent-emails', {
        agentType,
        instanceName: 'primary',
        emailAddress: getDefaultEmailPattern('primary'),
        isActive: true,
        customization: {},
      });
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-instances', selectedCompany?.id, 'individual', agentType] });
    },
    onError: (error) => {
      // Don't retry if authentication failed
      console.log('Auto-creation failed (likely not authenticated):', error);
    },
  });

  // Trigger auto-creation for individual users with no instances (prevent loops)
  const [hasTriedAutoCreate, setHasTriedAutoCreate] = React.useState(false);
  
  React.useEffect(() => {
    if (!selectedCompany && !isLoading && instances.length === 0 && !ensureDefaultInstance.isPending && !hasTriedAutoCreate && !error) {
      setHasTriedAutoCreate(true);
      ensureDefaultInstance.mutate();
    }
  }, [selectedCompany, isLoading, instances.length, ensureDefaultInstance, hasTriedAutoCreate, error]);

  // Get the primary instance (first one created or marked as primary)
  const primaryInstance = instances.length > 0 ? instances[0] : null;

  // Create new instance
  const createInstance = useMutation({
    mutationFn: async (data: {
      instanceName: string;
      emailAddress: string;
      customization?: Record<string, any>;
    }) => {
      let response;
      if (selectedCompany) {
        // Company mode
        response = await apiRequest('POST', `/api/companies/${selectedCompany.id}/agent-emails`, {
          agentType,
          instanceName: data.instanceName,
          emailAddress: data.emailAddress,
          isActive: true,
          customization: data.customization || {},
          inheritCompanySettings: true,
          allowGlobalEmails: false,
        });
      } else {
        // Individual mode
        response = await apiRequest('POST', '/api/user/agent-emails', {
          agentType,
          instanceName: data.instanceName,
          emailAddress: data.emailAddress,
          isActive: true,
          customization: data.customization || {},
        });
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-instances', selectedCompany?.id, 'individual', agentType] });
    },
  });

  // Update instance
  const updateInstance = useMutation({
    mutationFn: async (data: {
      instanceId: number;
      updates: Partial<Pick<AgentInstance, 'instanceName' | 'emailAddress' | 'isActive' | 'customization'>>;
    }) => {
      let response;
      if (selectedCompany) {
        // Company mode
        response = await apiRequest('PATCH', `/api/companies/${selectedCompany.id}/agent-emails/${data.instanceId}`, data.updates);
      } else {
        // Individual mode
        response = await apiRequest('PATCH', `/api/user/agent-emails/${data.instanceId}`, data.updates);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-instances', selectedCompany?.id, 'individual', agentType] });
    },
  });

  // Delete instance
  const deleteInstance = useMutation({
    mutationFn: async (instanceId: number) => {
      if (selectedCompany) {
        // Company mode
        await apiRequest('DELETE', `/api/companies/${selectedCompany.id}/agent-emails/${instanceId}`);
      } else {
        // Individual mode
        await apiRequest('DELETE', `/api/user/agent-emails/${instanceId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-instances', selectedCompany?.id, 'individual', agentType] });
    },
  });

  // Helper to get default email pattern
  const getDefaultEmailPattern = (instanceName?: string) => {
    if (selectedCompany) {
      // Company mode
      const sanitizedCompany = selectedCompany.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 15);
      
      if (instanceName) {
        const sanitizedInstance = instanceName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .substring(0, 10);
        
        return `${agentType}+${sanitizedCompany}-${sanitizedInstance}@inboxleap.com`;
      }
      
      return `${agentType}+${sanitizedCompany}@inboxleap.com`;
    } else {
      // Individual mode - use clean format for primary, instance ID for others
      if (!instanceName || instanceName.toLowerCase() === 'primary' || instanceName.toLowerCase() === 'default') {
        return `${agentType}@inboxleap.com`;
      } else {
        // Generate unique instance ID for non-primary instances
        const instanceId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        return `${agentType}+${instanceId}@inboxleap.com`;
      }
    }
  };

  return {
    instances,
    primaryInstance,
    isLoading,
    error,
    hasInstances: instances.length > 0,
    isCompanyMode: !!selectedCompany,
    isIndividualMode: !selectedCompany,
    companyName: selectedCompany?.name,
    createInstance,
    updateInstance,
    deleteInstance,
    getDefaultEmailPattern,
  };
};

export default useAgentInstances;