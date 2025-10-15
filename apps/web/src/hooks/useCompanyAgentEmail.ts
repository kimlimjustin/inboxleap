import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';

interface CompanyAgentEmail {
  id: number;
  companyId: number;
  agentType: string;
  emailAddress: string;
  isActive: boolean;
  customization: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export const useCompanyAgentEmail = (agentType: string, instanceId?: number) => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();

  const { data: agentEmail, isLoading, error } = useQuery({
    queryKey: ['company-agent-email', selectedCompany?.id, agentType],
    queryFn: async () => {
      if (!selectedCompany) return null;
      
      try {
        const response = await (await apiRequest('GET', `/api/companies/${selectedCompany.id}/agent-emails`)).json();
        if (response.success) {
          const agentEmails: CompanyAgentEmail[] = response.data.agentEmails;
          return agentEmails.find(email => email.agentType === agentType && email.isActive) || null;
        }
        return null;
      } catch (error) {
        console.error('Error fetching company agent email:', error);
        return null;
      }
    },
    enabled: !!selectedCompany && !!agentType,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Return the company-specific email or fall back to a default pattern
  const getAgentEmail = () => {
    if (agentEmail) {
      return agentEmail.emailAddress;
    }
    
    // If no company selected and no specific instance, use default base email
    if (!selectedCompany) {
      // If it's a specific instance, use instanceId for routing
      if (instanceId) {
        return `${agentType}+instance${instanceId}@inboxleap.com`;
      }
      // Default instance uses base email (parseable from sender context)
      return `${agentType}@inboxleap.com`;
    }
    
    // For company instances, use company name for routing identification
    const sanitizedCompanyName = selectedCompany.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);
    return `${agentType}+${sanitizedCompanyName}@inboxleap.com`;
  };

  const hasConfiguredEmail = !!agentEmail;
  const isIndividualMode = !selectedCompany;

  return {
    agentEmail: getAgentEmail(),
    hasConfiguredEmail,
    isIndividualMode,
    isLoading,
    error,
    companyName: selectedCompany?.name,
  };
};