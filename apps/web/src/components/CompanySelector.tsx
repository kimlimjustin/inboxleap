import { useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, ChevronDown, User, Mail } from "lucide-react";

export default function CompanySelector() {
  const { selectedCompany, companies, isLoading, switchCompany, switchToIndividual, isIndividualMode } = useCompany();
  const [isSwitching, setIsSwitching] = useState(false);

  const handleCompanySwitch = async (companyId: number) => {
    setIsSwitching(true);
    try {
      await switchCompany(companyId);
      
      // Refresh the page to ensure all data is updated with new company context
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch company:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleSwitchToIndividual = async () => {
    setIsSwitching(true);
    try {
      await switchToIndividual();
      
      // Refresh the page to ensure all data is updated with new context
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch to individual mode:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100">
        <Building2 className="h-4 w-4 text-gray-400" />
        <div className="h-4 w-24 bg-gray-300 rounded animate-pulse"></div>
      </div>
    );
  }

  if (isIndividualMode) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="flex items-center gap-2 max-w-48 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
            disabled={isSwitching}
          >
            <User className="h-4 w-4" />
            <span className="text-sm font-medium">Personal</span>
            <Badge variant="secondary" className="text-xs">Individual</Badge>
            <ChevronDown className="h-4 w-4 ml-auto" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 bg-white border border-gray-200 shadow-lg">
          <DropdownMenuLabel className="text-gray-700 font-medium">Switch Context</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-gray-200" />
          
          <DropdownMenuItem disabled className="opacity-100 bg-blue-50 border-l-2 border-blue-500">
            <User className="h-4 w-4 mr-2 text-blue-600" />
            <div className="flex items-center justify-between w-full">
              <span className="text-gray-900 font-medium">Personal</span>
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            </div>
          </DropdownMenuItem>
          
          {companies.length > 0 && (
            <>
              <DropdownMenuSeparator className="bg-gray-200" />
              <DropdownMenuLabel className="text-gray-700 font-medium">Companies</DropdownMenuLabel>
              {companies.map((company) => (
                <DropdownMenuItem
                  key={company.id}
                  onClick={() => handleCompanySwitch(company.id)}
                  disabled={isSwitching}
                  className="cursor-pointer hover:bg-gray-50 focus:bg-gray-50"
                >
                  <Building2 className="h-4 w-4 mr-2 text-gray-600" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate text-gray-900">{company.name}</span>
                    </div>
                    {company.description && (
                      <p className="text-xs text-gray-600 truncate">{company.description}</p>
                    )}
                    {company.emailAddress && (
                      <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                        <Mail className="h-3 w-3" />
                        <span>{company.emailAddress}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {company.userMembership.role}
                      </Badge>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {company.companyType}
                      </Badge>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2 max-w-48"
          disabled={isSwitching}
        >
          <Building2 className="h-4 w-4" />
          <span className="truncate text-sm">
            {selectedCompany?.name || 'Select Company'}
          </span>
          {selectedCompany && (
            <Badge variant="secondary" className="text-xs ml-1">
              {selectedCompany.userMembership.role}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start" className="w-64 bg-white border border-gray-200 shadow-lg">
        <DropdownMenuLabel className="flex items-center gap-2 text-gray-700 font-medium">
          <Building2 className="h-4 w-4" />
          Switch Context
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-200" />
        
        {/* Individual Account Option */}
        <DropdownMenuItem
          onClick={handleSwitchToIndividual}
          disabled={isIndividualMode || isSwitching}
          className="flex items-center justify-between py-2 hover:bg-gray-50 focus:bg-gray-50"
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-600" />
              <span className="font-medium text-gray-900">Individual Account</span>
              {isIndividualMode && (
                <Badge variant="default" className="text-xs bg-blue-500 text-white">
                  Active
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                Personal
              </Badge>
            </div>
          </div>
        </DropdownMenuItem>
        
        {companies.length > 0 && <DropdownMenuSeparator className="bg-gray-200" />}
        
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => handleCompanySwitch(company.id)}
            disabled={selectedCompany?.id === company.id || isSwitching}
            className="flex items-center justify-between py-2 hover:bg-gray-50 focus:bg-gray-50"
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-900">{company.name}</span>
                {selectedCompany?.id === company.id && (
                  <Badge variant="default" className="text-xs bg-blue-500 text-white">
                    Active
                  </Badge>
                )}
              </div>
              {company.emailAddress && (
                <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                  <Mail className="h-3 w-3" />
                  <span>{company.emailAddress}</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs border-gray-300 text-gray-700">
                  {company.userMembership.role}
                </Badge>
                <Badge variant="secondary" className="text-xs capitalize bg-gray-100 text-gray-700">
                  {company.companyType}
                </Badge>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator className="bg-gray-200" />
        <DropdownMenuItem 
          onClick={() => window.location.href = '/companies'}
          className="text-blue-600 hover:bg-blue-50 focus:bg-blue-50"
        >
          <Building2 className="h-4 w-4 mr-2" />
          Manage Companies
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}