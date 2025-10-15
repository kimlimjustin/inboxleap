import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface Company {
  id: number;
  name: string;
  description?: string;
  emailAddress?: string;
  companyType: 'main' | 'subsidiary' | 'division' | 'project';
  createdAt: string;
  userMembership: {
    role: 'admin' | 'manager' | 'member';
    department?: string;
    isActive: boolean;
  };
}

interface CompanyContextType {
  selectedCompany: Company | null;
  companies: Company[];
  isLoading: boolean;
  switchCompany: (companyId: number) => Promise<void>;
  switchToIndividual: () => Promise<void>;
  refreshCompanies: () => Promise<void>;
  isIndividualMode: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}

interface CompanyProviderProps {
  children: ReactNode;
}

export function CompanyProvider({ children }: CompanyProviderProps) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is in individual mode (no selected company or explicitly in individual mode)
  const isIndividualMode = selectedCompany === null;

  const loadCompanies = async () => {
    try {
      setIsLoading(true);
      const response = await (await apiRequest('GET', '/api/companies')).json();
      const rawCompaniesData = response.data?.companies || [];
      console.log('CompanyContext: Loading companies, count:', rawCompaniesData.length, rawCompaniesData);
      
      // Transform the data structure from backend format to frontend format
      const companiesData = rawCompaniesData.map((item: any) => ({
        id: item.company.id,
        name: item.company.name,
        description: item.company.description,
        companyType: item.company.companyType,
        createdAt: item.company.createdAt,
        userMembership: {
          role: item.membership.role,
          department: item.membership.department,
          isActive: item.membership.isActive
        },
        memberCount: item.memberCount,
        departmentCount: item.departmentCount
      }));
      
      console.log('CompanyContext: Transformed companies:', companiesData);
      setCompanies(companiesData);

      // Restore selected company from localStorage, but respect individual mode preference
      const savedCompanyId = localStorage.getItem('selectedCompany');
      const isIndividualPreferred = localStorage.getItem('preferIndividualMode') === 'true';
      
      if (isIndividualPreferred || savedCompanyId === 'individual') {
        // User explicitly chose individual mode
        setSelectedCompany(null);
        localStorage.setItem('selectedCompany', 'individual');
      } else if (savedCompanyId && savedCompanyId !== 'individual' && companiesData.length > 0) {
        // User had a specific company selected
        const companyToSelect = companiesData.find((c: Company) => c.id === parseInt(savedCompanyId));
        if (companyToSelect) {
          setSelectedCompany(companyToSelect);
          localStorage.setItem('selectedCompany', companyToSelect.id.toString());
        } else {
          // Previously selected company no longer exists, default to individual mode
          setSelectedCompany(null);
          localStorage.setItem('selectedCompany', 'individual');
        }
      } else {
        // No preference set and has companies - default to individual mode to avoid auto-selecting
        setSelectedCompany(null);
        localStorage.setItem('selectedCompany', 'individual');
      }
    } catch (error) {
      console.error('Error loading companies:', error);
      setCompanies([]);
      setSelectedCompany(null);
      localStorage.removeItem('selectedCompany');
    } finally {
      setIsLoading(false);
    }
  };

  const switchCompany = async (companyId: number) => {
    const company = companies.find(c => c.id === companyId);
    if (company) {
      setSelectedCompany(company);
      localStorage.setItem('selectedCompany', companyId.toString());
      localStorage.removeItem('preferIndividualMode');
      
      // Emit a custom event to notify other parts of the app
      window.dispatchEvent(new CustomEvent('companyChanged', { 
        detail: { companyId, company } 
      }));
    }
  };

  const switchToIndividual = async () => {
    setSelectedCompany(null);
    localStorage.setItem('selectedCompany', 'individual');
    localStorage.setItem('preferIndividualMode', 'true');
    
    // Emit a custom event to notify other parts of the app
    window.dispatchEvent(new CustomEvent('companyChanged', { 
      detail: { companyId: null, company: null, isIndividual: true } 
    }));
  };

  const refreshCompanies = async () => {
    await loadCompanies();
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const value = {
    selectedCompany,
    companies,
    isLoading,
    switchCompany,
    switchToIndividual,
    refreshCompanies,
    isIndividualMode,
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}