import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIdentity } from "@/contexts/IdentityContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Building2, Users, Mail, Settings, ArrowLeft, Plus, User, Shield, Briefcase } from "lucide-react";

interface IdentityDetails {
  identity: {
    id: number;
    type: 'user' | 'company';
    userId?: string;
    companyId?: number;
    displayName: string;
    description?: string;
    createdAt: Date;
    updatedAt?: Date;
    company?: {
      id: number;
      name: string;
      description?: string;
      emailAddress?: string;
    };
  };
  permissions: {
    canManageAgents: boolean;
    canManageProjects: boolean;
    canManageTasks: boolean;
    role: string;
  };
  agentInstances?: Array<{
    id: number;
    agentType: string;
    instanceName: string;
    emailAddress: string;
    isActive: boolean;
  }>;
  projects?: Array<{
    id: number;
    name: string;
    type: string;
    createdAt: Date;
  }>;
}

interface IdentityAccess {
  id: number;
  userId: string;
  role: string;
  canManageAgents: boolean;
  canManageProjects: boolean;
  canManageTasks: boolean;
  isActive: boolean;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export default function IdentitiesPage() {
  const { user } = useAuth();
  const {
    currentIdentity,
    personalIdentity,
    companyIdentities,
    switchIdentity,
    refreshIdentities,
  } = useIdentity();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [selectedIdentityId, setSelectedIdentityId] = useState<number | null>(null);
  const [identityDetails, setIdentityDetails] = useState<IdentityDetails | null>(null);
  const [identityAccess, setIdentityAccess] = useState<IdentityAccess[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(false);

  // Load identity details
  const loadIdentityDetails = async (identityId: number) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`/api/identities/${identityId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load identity details');
      }

      const data = await response.json();
      setIdentityDetails(data);

      // Load agent instances
      const instancesResponse = await fetch(`/api/identities/${identityId}/agent-instances`, {
        credentials: 'include',
      });
      if (instancesResponse.ok) {
        const instancesData = await instancesResponse.json();
        setIdentityDetails(prev => prev ? {
          ...prev,
          agentInstances: instancesData.instances
        } : null);
      }

      // Load projects
      const projectsResponse = await fetch(`/api/identities/${identityId}/projects`, {
        credentials: 'include',
      });
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setIdentityDetails(prev => prev ? {
          ...prev,
          projects: projectsData.projects
        } : null);
      }
    } catch (error: any) {
      console.error('Error loading identity details:', error);
      toast({
        title: "Error",
        description: "Failed to load identity details",
        variant: "destructive",
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  // Load identity access (for company identities)
  const loadIdentityAccess = async (identityId: number) => {
    setLoadingAccess(true);
    try {
      const response = await fetch(`/api/identities/${identityId}/access`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load identity access');
      }

      const data = await response.json();
      setIdentityAccess(data.access || []);
    } catch (error: any) {
      console.error('Error loading identity access:', error);
      // Don't show error for personal identities
      if (identityDetails?.identity.type === 'company') {
        toast({
          title: "Error",
          description: "Failed to load team members",
          variant: "destructive",
        });
      }
    } finally {
      setLoadingAccess(false);
    }
  };

  // Handle identity selection
  const handleSelectIdentity = (identityId: number) => {
    setSelectedIdentityId(identityId);
    loadIdentityDetails(identityId);
  };

  // Load details for currently selected company identity
  useEffect(() => {
    if (currentIdentity?.type === 'company') {
      handleSelectIdentity(currentIdentity.id);
    } else if (companyIdentities.length > 0) {
      handleSelectIdentity(companyIdentities[0].id);
    }
  }, [currentIdentity, companyIdentities]);

  // Load access when identity details change
  useEffect(() => {
    if (identityDetails?.identity.type === 'company') {
      loadIdentityAccess(identityDetails.identity.id);
    } else {
      setIdentityAccess([]);
    }
  }, [identityDetails]);

  const handleSwitchToIdentity = async (identityId: number) => {
    try {
      await switchIdentity(identityId);
      toast({
        title: "Success",
        description: "Switched identity successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to switch identity",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Identity Management</h1>
          <p className="mt-2 text-gray-600">
            Manage your personal and company identities, view team members, and control access.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Identity List */}
          <div className="lg:col-span-1 space-y-4">
            {/* Personal Identity */}
            {personalIdentity && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4" />
                    Personal Identity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <button
                    onClick={() => handleSelectIdentity(personalIdentity.id)}
                    className={`w-full p-3 border rounded-lg text-left transition-colors ${
                      selectedIdentityId === personalIdentity.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{personalIdentity.displayName}</p>
                        <p className="text-xs text-gray-500">Owner</p>
                      </div>
                      {currentIdentity?.id === personalIdentity.id && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  </button>
                </CardContent>
              </Card>
            )}

            {/* Company Identities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Company Identities
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {companyIdentities.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No company identities</p>
                    <p className="text-xs mt-1">You're not part of any companies yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {companyIdentities.map((identity) => (
                      <button
                        key={identity.id}
                        onClick={() => handleSelectIdentity(identity.id)}
                        className={`w-full p-3 border rounded-lg text-left transition-colors ${
                          selectedIdentityId === identity.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{identity.displayName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {identity.role}
                              </Badge>
                            </div>
                          </div>
                          {currentIdentity?.id === identity.id && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 flex-shrink-0"></div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Identity Details */}
          <div className="lg:col-span-2 space-y-4">
            {!selectedIdentityId ? (
              <Card>
                <CardContent className="pt-12 pb-12">
                  <div className="text-center text-gray-500">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Select an identity to view details</p>
                  </div>
                </CardContent>
              </Card>
            ) : loadingDetails ? (
              <Card>
                <CardContent className="pt-12 pb-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">Loading identity details...</p>
                  </div>
                </CardContent>
              </Card>
            ) : identityDetails ? (
              <>
                {/* Identity Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {identityDetails.identity.type === 'user' ? (
                          <User className="h-5 w-5" />
                        ) : (
                          <Building2 className="h-5 w-5" />
                        )}
                        {identityDetails.identity.displayName}
                      </div>
                      {currentIdentity?.id !== identityDetails.identity.id && (
                        <Button
                          size="sm"
                          onClick={() => handleSwitchToIdentity(identityDetails.identity.id)}
                        >
                          Switch to this identity
                        </Button>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {identityDetails.identity.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Type</p>
                        <p className="text-sm capitalize">{identityDetails.identity.type}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Your Role</p>
                        <Badge variant="secondary">{identityDetails.permissions.role}</Badge>
                      </div>
                    </div>

                    {identityDetails.identity.company && (
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Company</p>
                        <p className="text-sm">{identityDetails.identity.company.name}</p>
                        {identityDetails.identity.company.emailAddress && (
                          <div className="flex items-center gap-1 mt-1">
                            <Mail className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-600">
                              {identityDetails.identity.company.emailAddress}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-gray-500 mb-2">Permissions</p>
                      <div className="flex flex-wrap gap-2">
                        {identityDetails.permissions.canManageAgents && (
                          <Badge variant="outline" className="text-xs">
                            Manage Agents
                          </Badge>
                        )}
                        {identityDetails.permissions.canManageProjects && (
                          <Badge variant="outline" className="text-xs">
                            Manage Projects
                          </Badge>
                        )}
                        {identityDetails.permissions.canManageTasks && (
                          <Badge variant="outline" className="text-xs">
                            Manage Tasks
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Agent Instances */}
                {identityDetails.agentInstances && identityDetails.agentInstances.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Mail className="h-4 w-4" />
                        Agent Instances
                      </CardTitle>
                      <CardDescription>
                        Email agents configured for this identity
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {identityDetails.agentInstances.map((instance) => (
                          <div
                            key={instance.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-sm">{instance.instanceName}</p>
                                <Badge variant="secondary" className="text-xs">
                                  {instance.agentType}
                                </Badge>
                                {!instance.isActive && (
                                  <Badge variant="outline" className="text-xs">
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 font-mono">
                                {instance.emailAddress}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Projects */}
                {identityDetails.projects && identityDetails.projects.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Briefcase className="h-4 w-4" />
                        Projects ({identityDetails.projects.length})
                      </CardTitle>
                      <CardDescription>
                        Projects associated with this identity
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {identityDetails.projects.slice(0, 5).map((project) => (
                          <div
                            key={project.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <p className="font-medium text-sm">{project.name}</p>
                              <p className="text-xs text-gray-500 capitalize">{project.type}</p>
                            </div>
                            <p className="text-xs text-gray-400">
                              {new Date(project.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                        {identityDetails.projects.length > 5 && (
                          <p className="text-xs text-gray-500 text-center pt-2">
                            + {identityDetails.projects.length - 5} more projects
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Team Members (for company identities) */}
                {identityDetails.identity.type === 'company' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="h-4 w-4" />
                        Team Members ({identityAccess.length})
                      </CardTitle>
                      <CardDescription>
                        Users with access to this company identity
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingAccess ? (
                        <div className="text-center py-6">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2"></div>
                          <p className="text-xs text-gray-500">Loading team members...</p>
                        </div>
                      ) : identityAccess.length === 0 ? (
                        <div className="text-center py-6 text-gray-500">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No team members yet</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {identityAccess.map((access) => (
                            <div
                              key={access.id}
                              className="flex items-center justify-between p-3 border rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                  <span className="text-xs font-medium">
                                    {access.user?.firstName?.[0] || access.user?.email[0].toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm">
                                      {access.user?.firstName && access.user?.lastName
                                        ? `${access.user.firstName} ${access.user.lastName}`
                                        : access.user?.email || 'Unknown'}
                                    </p>
                                    <Badge variant="outline" className="text-xs">
                                      {access.role}
                                    </Badge>
                                  </div>
                                  {access.user?.email && (
                                    <p className="text-xs text-gray-500">{access.user.email}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1 text-xs">
                                {access.canManageAgents && (
                                  <Badge variant="secondary" className="text-xs">A</Badge>
                                )}
                                {access.canManageProjects && (
                                  <Badge variant="secondary" className="text-xs">P</Badge>
                                )}
                                {access.canManageTasks && (
                                  <Badge variant="secondary" className="text-xs">T</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}