import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Company {
  id: string;
  name: string;
  domain: string;
  logo?: string;
}

interface CompanyContextType {
  currentCompany: Company | null;
  companies: Company[];
  switchCompany: (companyId: string) => void;
  addCompany: (company: Omit<Company, 'id'>) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const [companies] = useState<Company[]>([
    { id: '1', name: 'Acme Corp', domain: 'acme.com' },
    { id: '2', name: 'TechStart Inc', domain: 'techstart.io' },
  ]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(companies[0]);

  const switchCompany = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    if (company) {
      setCurrentCompany(company);
    }
  };

  const addCompany = (company: Omit<Company, 'id'>) => {
    // Mock add company
    console.log('Adding company:', company);
  };

  return (
    <CompanyContext.Provider
      value={{
        currentCompany,
        companies,
        switchCompany,
        addCompany,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};