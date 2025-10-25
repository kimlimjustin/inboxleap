import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Shield, Bell, User, Mail, Link, Unlink, Plus, Building2, Users, Briefcase, Settings, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

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

interface TeamMember {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  department?: string;
  joinedAt: string;
}

interface TeamInvitation {
  id: number;
  inviteeEmail: string;
  role: string;
  department?: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  message?: string;
}

interface InviteTeamMemberForm {
  email: string;
  role: string;
  department: string;
  message: string;
}

const AGENT_TYPES = [
  { value: 'todo', label: 'Todo', description: 'Project management agent' },
  { value: 'analyzer', label: 'Alex', description: 'Document analysis agent' },
  { value: 'polly', label: 'Polly', description: 'Polling and surveys agent' },
  { value: 'faq', label: 'FAQ', description: 'Frequently asked questions' },
  { value: 't5t', label: 'Tanya', description: 'Customer intelligence agent' }
] as const;

interface CreateCompanyForm {
  name: string;
  description: string;
  emailAddress: string;
  domainRestrictions: {
    enabled: boolean;
    domains: string[];
  };
}

export default function CompaniesPage() {
  const { user } = useAuth();
  const { selectedCompany, companies, isLoading: companiesLoading, switchCompany, refreshCompanies } = useCompany();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // State for various UI components
  const [updating, setUpdating] = useState<string | null>(null);
  
  // Company management state
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);
  const [showEditCompanyModal, setShowEditCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [createCompanyForm, setCreateCompanyForm] = useState<CreateCompanyForm>({
    name: '',
    description: '',
    emailAddress: '',
    domainRestrictions: {
      enabled: false,
      domains: []
    }
  });
  const [editCompanyForm, setEditCompanyForm] = useState<Partial<CreateCompanyForm>>({});
  
  // Agent email management state
  const [showAgentEmailModal, setShowAgentEmailModal] = useState(false);
  const [selectedAgentType, setSelectedAgentType] = useState<string>('');
  const [customEmailAddress, setCustomEmailAddress] = useState<string>('');
  const [companyAgentEmails, setCompanyAgentEmails] = useState<CompanyAgentEmail[]>([]);

  // Team management state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteTeamMemberForm>({
    email: '',
    role: 'member',
    department: '',
    message: ''
  });
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInvitations, setTeamInvitations] = useState<TeamInvitation[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Company creation function
  const handleCreateCompany = async () => {
    if (!createCompanyForm.name.trim()) {
      toast({
        title: "Error",
        description: "Company name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setUpdating('create-company');
      console.log('Creating company with data:', createCompanyForm);
      
      const response = await (await apiRequest('POST', '/api/companies/register', createCompanyForm)).json();
      
      console.log('Company creation response:', response);
      
      if (response.success) {
        // Reset form and close modal first
        setCreateCompanyForm({
          name: '',
          description: '',
          emailAddress: '',
          domainRestrictions: { enabled: false, domains: [] }
        });
        setShowCreateCompanyModal(false);

        // Refresh companies from context with a small delay to ensure the backend is updated
        setTimeout(async () => {
          await refreshCompanies();
          console.log('Companies refreshed after creation');
        }, 1000);
        
        toast({
          title: "Success",
          description: "Company created successfully",
        });
      } else {
        throw new Error(response.message || 'Failed to create company');
      }
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create company",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleSwitchCompany = async (companyId: number) => {
    await switchCompany(companyId);
    toast({
      title: "Company Switched",
      description: "You are now working in the selected company context",
    });
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setEditCompanyForm({
      name: company.name,
      description: company.description || '',
      emailAddress: company.emailAddress || '',
    });
    setShowEditCompanyModal(true);
  };

  const handleUpdateCompany = async () => {
    if (!editingCompany) return;

    try {
      setUpdating('edit-company');
      const response = await (await apiRequest('PATCH', `/api/companies/${editingCompany.id}`, editCompanyForm)).json();
      
      if (response.success) {
        setShowEditCompanyModal(false);
        setEditingCompany(null);
        setEditCompanyForm({});
        
        // Refresh companies
        await refreshCompanies();
        
        toast({
          title: "Company Updated",
          description: "Company information has been updated successfully",
        });
      } else {
        throw new Error(response.message || 'Failed to update company');
      }
    } catch (error: any) {
      console.error('Error updating company:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update company",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  // Agent email management functions
  const loadCompanyAgentEmails = async (companyId: number) => {
    try {
      const response = await (await apiRequest('GET', `/api/companies/${companyId}/agent-emails`)).json();
      if (response.success) {
        setCompanyAgentEmails(response.data.agentEmails);
      }
    } catch (error: any) {
      console.error('Error loading agent emails:', error);
      toast({
        title: "Error",
        description: "Failed to load agent emails",
        variant: "destructive",
      });
    }
  };

  const handleConfigureAgentEmail = async (agentType: string) => {
    if (!selectedCompany) return;
    
    try {
      // Generate default email for this agent type
      const response = await (await apiRequest('GET', `/api/companies/${selectedCompany.id}/agent-emails/generate-default/${agentType}`)).json();
      if (response.success) {
        setSelectedAgentType(agentType);
        setCustomEmailAddress(response.data.emailAddress);
        setShowAgentEmailModal(true);
      }
    } catch (error: any) {
      console.error('Error generating default email:', error);
      toast({
        title: "Error", 
        description: "Failed to generate default email address",
        variant: "destructive",
      });
    }
  };

  const handleSaveAgentEmail = async () => {
    if (!selectedCompany || !selectedAgentType) return;

    try {
      setUpdating('agent-email');
      const response = await (await apiRequest('POST', `/api/companies/${selectedCompany.id}/agent-emails`, {
        agentType: selectedAgentType,
        emailAddress: customEmailAddress || undefined,
        isActive: true
      })).json();
      
      if (response.success) {
        setShowAgentEmailModal(false);
        setSelectedAgentType('');
        setCustomEmailAddress('');
        
        // Reload agent emails
        await loadCompanyAgentEmails(selectedCompany.id);
        
        toast({
          title: "Success",
          description: "Agent email configured successfully",
        });
      } else {
        throw new Error(response.message || 'Failed to configure agent email');
      }
    } catch (error: any) {
      console.error('Error saving agent email:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to configure agent email",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  // Team management functions
  const loadTeamData = async (companyId: number) => {
    if (!companyId) return;
    
    setLoadingTeam(true);
    try {
      // Load team members
      const membersResponse = await (await apiRequest('GET', `/api/companies/${companyId}/members`)).json();
      if (membersResponse.success) {
        // Transform API response to TeamMember format
        const transformedMembers = membersResponse.data.members
          .filter((member: any) => member.user) // Filter out members without user data
          .map((member: any) => ({
            id: member.user.id,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
            email: member.user.email,
            role: member.membership.role,
            department: member.membership.department,
            joinedAt: member.membership.createdAt
          }));
        setTeamMembers(transformedMembers);
      }

      // Load pending invitations
      const invitationsResponse = await (await apiRequest('GET', `/api/companies/${companyId}/invitations`)).json();
      if (invitationsResponse.success) {
        setTeamInvitations(invitationsResponse.data.invitations || []);
      }
    } catch (error: any) {
      console.error('Error loading team data:', error);
      toast({
        title: "Error",
        description: "Failed to load team data",
        variant: "destructive",
      });
    } finally {
      setLoadingTeam(false);
    }
  };

  const handleInviteTeamMember = async () => {
    if (!selectedCompany || !inviteForm.email.trim()) {
      toast({
        title: "Error",
        description: "Email address is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setUpdating('invite-member');
      const response = await (await apiRequest('POST', `/api/companies/${selectedCompany.id}/invitations`, inviteForm)).json();
      
      if (response.success) {
        setShowInviteModal(false);
        setInviteForm({ email: '', role: 'member', department: '', message: '' });
        
        // Reload invitations
        await loadTeamData(selectedCompany.id);
        
        toast({
          title: "Invitation Sent",
          description: `Team member invitation sent to ${inviteForm.email}`,
        });
      } else {
        throw new Error(response.message || 'Failed to send invitation');
      }
    } catch (error: any) {
      console.error('Error inviting team member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleCancelInvitation = async (invitationId: number) => {
    if (!selectedCompany) return;

    try {
      setUpdating('cancel-invitation');
      const response = await (await apiRequest('DELETE', `/api/companies/${selectedCompany.id}/invitations/${invitationId}`)).json();
      
      if (response.success) {
        await loadTeamData(selectedCompany.id);
        toast({
          title: "Invitation Cancelled",
          description: "The invitation has been cancelled",
        });
      } else {
        throw new Error(response.message || 'Failed to cancel invitation');
      }
    } catch (error: any) {
      console.error('Error cancelling invitation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel invitation",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  // Load agent emails and team data when company changes
  useEffect(() => {
    if (selectedCompany) {
      loadCompanyAgentEmails(selectedCompany.id);
      loadTeamData(selectedCompany.id);
    } else {
      setCompanyAgentEmails([]);
      setTeamMembers([]);
      setTeamInvitations([]);
    }
  }, [selectedCompany]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/dashboard')}
              className="flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/20 border-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Companies</h1>
          <p className="text-white/90 text-lg">
            Manage your companies, team members, and organizational structure.
          </p>
        </div>
      </div>
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Company Management */}
      <Card className="bg-gradient-to-br from-white via-gray-50/30 to-white border border-gray-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <CardTitle className="flex items-center justify-between text-gray-900">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Companies
            </div>
            <Button
              onClick={() => setShowCreateCompanyModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Create Company
            </Button>
          </CardTitle>
          <CardDescription>
            Manage your companies and switch between different organizational contexts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {companiesLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading companies...</p>
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No companies yet</h3>
              <p className="text-gray-500 mb-4">Create your first company to start organizing your work</p>
              <Button 
                onClick={() => setShowCreateCompanyModal(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Company
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md ${
                      selectedCompany?.id === company.id 
                        ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-blue-100/50 shadow-md' 
                        : 'border-gray-200 hover:border-gray-300 bg-gradient-to-br from-white to-gray-50/30'
                    }`}
                    onClick={() => handleSwitchCompany(company.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900">{company.name}</h3>
                          <Badge variant="outline" className="text-xs capitalize">
                            {company.companyType}
                          </Badge>
                        </div>
                        {company.description && (
                          <p className="text-sm text-gray-500">{company.description}</p>
                        )}
                        {company.emailAddress && (
                          <div className="flex items-center gap-1 mt-1">
                            <Mail className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-600">{company.emailAddress}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {company.userMembership.role}
                          </Badge>
                          {company.userMembership.department && (
                            <span className="text-xs text-gray-400">
                              {company.userMembership.department}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {company.userMembership.role === 'admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCompany(company);
                            }}
                            className="h-8 w-8 p-0 hover:bg-gray-100"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        )}
                        {selectedCompany?.id === company.id ? (
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        ) : (
                          <div className="w-3 h-3 border-2 border-gray-300 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200 rounded-lg p-4 shadow-sm">
                <h4 className="font-semibold text-blue-900 mb-2">Company Context</h4>
                <p className="text-sm text-blue-800">
                  When you select a company, all your projects, tasks, and agents will operate within that company's context. 
                  Each company maintains its own separate data and team members.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Email Management */}
      {selectedCompany && selectedCompany.userMembership.role === 'admin' && (
        <Card className="bg-gradient-to-br from-white via-gray-50/30 to-white border border-gray-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Mail className="h-5 w-5" />
              Agent Email Addresses
            </CardTitle>
            <CardDescription>
              Configure unique email addresses for each agent in {selectedCompany.name}. 
              Team members can send emails to these addresses to interact with specific agents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4">
                {AGENT_TYPES.map((agentType) => {
                  const existingEmail = companyAgentEmails.find(e => e.agentType === agentType.value);
                  
                  return (
                    <div key={agentType.value} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{agentType.label}</span>
                          <Badge variant="secondary" className="text-xs">
                            {agentType.value}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">{agentType.description}</p>
                        {existingEmail ? (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-green-600" />
                            <span className="text-sm font-mono text-green-600">
                              {existingEmail.emailAddress}
                            </span>
                            {!existingEmail.isActive && (
                              <Badge variant="secondary" className="text-xs ml-2">Inactive</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Not configured</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfigureAgentEmail(agentType.value)}
                          disabled={updating === 'agent-email'}
                        >
                          {existingEmail ? 'Edit' : 'Configure'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">How Agent Emails Work</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>Todo uses the shared <code className="bg-white px-1 rounded">todo@inboxleap.com</code> inbox while other agents can generate unique addresses</li>
                  <li>Team members send emails to these addresses to create tasks, projects, or get assistance</li>
                  <li>You can customize other agent email addresses or use the generated defaults (Todo remains on the shared inbox)</li>
                  <li>All email addresses must be unique across the platform</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members Management */}
      {selectedCompany && selectedCompany.userMembership.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </div>
              <Button 
                onClick={() => setShowInviteModal(true)}
                disabled={updating === 'invite-member'}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Invite Member
              </Button>
            </CardTitle>
            <CardDescription>
              Invite and manage team members for {selectedCompany.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingTeam ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading team members...</p>
              </div>
            ) : (
              <>
                {/* Active Team Members */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Active Members</h4>
                  {teamMembers.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No team members yet</p>
                      <p className="text-xs">Invite your first team member to get started</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {teamMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium">
                                {member.firstName?.[0] || member.email[0].toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">
                                  {member.firstName && member.lastName 
                                    ? `${member.firstName} ${member.lastName}` 
                                    : member.email
                                  }
                                </p>
                                <Badge variant="outline" className="text-xs">
                                  {member.role}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500">{member.email}</p>
                              {member.department && (
                                <p className="text-xs text-gray-400">{member.department}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-gray-400">
                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pending Invitations */}
                {teamInvitations.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Pending Invitations</h4>
                    <div className="grid gap-3">
                      {teamInvitations.map((invitation) => (
                        <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg bg-orange-50 border-orange-200">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                              <Mail className="h-4 w-4 text-orange-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{invitation.inviteeEmail}</p>
                                <Badge variant="outline" className="text-xs">
                                  {invitation.role}
                                </Badge>
                                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                                  {invitation.status}
                                </Badge>
                              </div>
                              {invitation.department && (
                                <p className="text-xs text-gray-500">{invitation.department}</p>
                              )}
                              <p className="text-xs text-gray-400">
                                Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelInvitation(invitation.id)}
                            disabled={updating === 'cancel-invitation'}
                            className="text-red-600 hover:text-red-700"
                          >
                            Cancel
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Company Hierarchy - Only show when there are team members */}
      {selectedCompany && selectedCompany.userMembership.role === 'admin' && teamMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Company Hierarchy
            </CardTitle>
            <CardDescription>
              Configure reporting relationships and organizational structure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Hierarchy Management</h4>
              <p className="text-sm text-blue-800 mb-4">
                Set up manager-employee relationships to enable proper task delegation and organization structure.
              </p>
              <div className="space-y-3">
                <div className="text-sm">
                  <strong>Current Team Size:</strong> {teamMembers.length} members
                </div>
                <div className="text-sm">
                  <strong>Available Features:</strong>
                  <ul className="list-disc ml-4 mt-1 space-y-1 text-xs">
                    <li>Set manager-employee relationships</li>
                    <li>Department-based organization</li>
                    <li>Role-based task routing</li>
                    <li>Organizational chart visualization</li>
                  </ul>
                </div>
                <Button variant="outline" size="sm" className="mt-3">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Hierarchy
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show hierarchy placeholder when no team members yet */}
      {selectedCompany && selectedCompany.userMembership.role === 'admin' && teamMembers.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Company Hierarchy
              <Badge variant="secondary" className="text-xs">Needs Team Members</Badge>
            </CardTitle>
            <CardDescription>
              Configure company structure, departments, and reporting relationships
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Invite team members to enable hierarchy management</p>
              <p className="text-xs mt-1">Once you have team members, you can set up reporting relationships and organizational structure</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      {/* Create Company Modal */}
      <Dialog open={showCreateCompanyModal} onOpenChange={setShowCreateCompanyModal}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-white via-gray-50/30 to-white border border-gray-200 shadow-xl">
          <DialogHeader className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 text-white p-6 -m-6 mb-6 rounded-t-lg">
            <DialogTitle className="text-white font-semibold">Create New Company</DialogTitle>
            <DialogDescription className="text-white/90">
              Set up a new company to organize your team's work and projects.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                type="text"
                placeholder="Enter company name"
                value={createCompanyForm.name}
                onChange={(e) => setCreateCompanyForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyDescription">Description</Label>
              <Input
                id="companyDescription"
                type="text"
                placeholder="Enter company description (optional)"
                value={createCompanyForm.description}
                onChange={(e) => setCreateCompanyForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyEmail">Email Address</Label>
              <Input
                id="companyEmail"
                type="email"
                placeholder="team@company.com (optional)"
                value={createCompanyForm.emailAddress}
                onChange={(e) => setCreateCompanyForm(prev => ({ ...prev, emailAddress: e.target.value }))}
              />
              <p className="text-xs text-gray-500">
                A unique email address where team members can send emails to this company's agents.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="domainRestrictions"
                checked={createCompanyForm.domainRestrictions.enabled}
                onCheckedChange={(checked) => 
                  setCreateCompanyForm(prev => ({
                    ...prev, 
                    domainRestrictions: { ...prev.domainRestrictions, enabled: checked }
                  }))
                }
              />
              <Label htmlFor="domainRestrictions" className="text-sm">
                Enable domain restrictions
              </Label>
            </div>
          </div>
          <DialogFooter className="border-t border-gray-200 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setCreateCompanyForm({
                  name: '',
                  description: '',
                  emailAddress: '',
                  domainRestrictions: { enabled: false, domains: [] }
                });
                setShowCreateCompanyModal(false);
              }}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCompany}
              disabled={!createCompanyForm.name.trim() || updating === 'create-company'}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium shadow-sm"
            >
              {updating === 'create-company' ? 'Creating...' : 'Create Company'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Modal */}
      <Dialog open={showEditCompanyModal} onOpenChange={setShowEditCompanyModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>
              Update company information and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editCompanyName">Company Name *</Label>
              <Input
                id="editCompanyName"
                type="text"
                placeholder="Enter company name"
                value={editCompanyForm.name || ''}
                onChange={(e) => setEditCompanyForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCompanyDescription">Description</Label>
              <Input
                id="editCompanyDescription"
                type="text"
                placeholder="Enter company description (optional)"
                value={editCompanyForm.description || ''}
                onChange={(e) => setEditCompanyForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCompanyEmail">Email Address</Label>
              <Input
                id="editCompanyEmail"
                type="email"
                placeholder="team@company.com (optional)"
                value={editCompanyForm.emailAddress || ''}
                onChange={(e) => setEditCompanyForm(prev => ({ ...prev, emailAddress: e.target.value }))}
              />
              <p className="text-xs text-gray-500">
                A unique email address where team members can send emails to this company's agents.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditCompanyForm({});
                setEditingCompany(null);
                setShowEditCompanyModal(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateCompany}
              disabled={!editCompanyForm.name?.trim() || updating === 'edit-company'}
            >
              {updating === 'edit-company' ? 'Updating...' : 'Update Company'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Agent Email Modal */}
      <Dialog open={showAgentEmailModal} onOpenChange={setShowAgentEmailModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Configure {AGENT_TYPES.find(t => t.value === selectedAgentType)?.label} Email
            </DialogTitle>
            <DialogDescription>
              Set up the email address for the {AGENT_TYPES.find(t => t.value === selectedAgentType)?.label} agent.
              Team members will send emails to this address to interact with the agent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agentEmail">Email Address</Label>
              <Input
                id="agentEmail"
                type="email"
                placeholder="agent+company@inboxleap.com"
                value={customEmailAddress}
                onChange={(e) => setCustomEmailAddress(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Leave empty to use the default generated email address.
              </p>
            </div>
            
            <div className="bg-gray-50 border rounded-lg p-3">
              <h4 className="text-sm font-medium mb-1">Agent Details</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <p><strong>Agent:</strong> {AGENT_TYPES.find(t => t.value === selectedAgentType)?.label}</p>
                <p><strong>Type:</strong> {selectedAgentType}</p>
                <p><strong>Description:</strong> {AGENT_TYPES.find(t => t.value === selectedAgentType)?.description}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAgentEmailModal(false);
                setSelectedAgentType('');
                setCustomEmailAddress('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAgentEmail}
              disabled={updating === 'agent-email'}
            >
              {updating === 'agent-email' ? 'Saving...' : 'Save Configuration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Team Member Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join {selectedCompany?.name}. They'll receive an email with instructions to accept.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email Address *</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="colleague@company.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteRole">Role</Label>
              <Select value={inviteForm.role} onValueChange={(value) => setInviteForm(prev => ({ ...prev, role: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteDepartment">Department (Optional)</Label>
              <Input
                id="inviteDepartment"
                type="text"
                placeholder="e.g., Engineering, Marketing"
                value={inviteForm.department}
                onChange={(e) => setInviteForm(prev => ({ ...prev, department: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteMessage">Personal Message (Optional)</Label>
              <Input
                id="inviteMessage"
                type="text"
                placeholder="Welcome to the team!"
                value={inviteForm.message}
                onChange={(e) => setInviteForm(prev => ({ ...prev, message: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setInviteForm({ email: '', role: 'member', department: '', message: '' });
                setShowInviteModal(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInviteTeamMember}
              disabled={!inviteForm.email.trim() || updating === 'invite-member'}
            >
              {updating === 'invite-member' ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}



