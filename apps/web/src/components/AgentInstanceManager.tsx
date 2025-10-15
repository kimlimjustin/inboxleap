import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Settings, Trash2, Mail, Copy, Check, Edit3, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AgentInstance {
  id: number;
  companyId: number;
  agentType: string;
  instanceName: string;
  emailAddress: string;
  isActive: boolean;
  isDefault?: boolean;
  customization: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface AgentInstanceManagerProps {
  agentType: string;
  agentName: string;
  onInstanceSelect?: (instance: AgentInstance | null) => void;
  selectedInstanceId?: number;
  entityLabel?: { singular: string; plural?: string };
}

export const AgentInstanceManager: React.FC<AgentInstanceManagerProps> = ({
  agentType,
  agentName,
  onInstanceSelect,
  selectedInstanceId,
  entityLabel,
}) => {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const labelSingular = entityLabel?.singular ?? 'Topic';
  const labelPlural = entityLabel?.plural ?? `${labelSingular}s`;
  const labelSingularLower = labelSingular.toLowerCase();
  const labelPluralLower = labelPlural.toLowerCase();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [newInstanceEmail, setNewInstanceEmail] = useState('');
  const [copiedEmails, setCopiedEmails] = useState<Set<string>>(new Set());
  const [editingInstanceId, setEditingInstanceId] = useState<number | null>(null);
  const [editingEmail, setEditingEmail] = useState<string>('');
  const [createError, setCreateError] = useState<string>('');

  // Fetch agent instances for the current company or individual user
  const { data: instances = [], isLoading } = useQuery({
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
            );
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
            }));
          }
        }
        return [];
      } catch (error) {
        console.error('Error fetching agent instances:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Create new agent instance
  const createInstanceMutation = useMutation({
    mutationFn: async (data: { instanceName: string; emailAddress: string }) => {
      let response;
      if (selectedCompany) {
        // Company mode
        response = await apiRequest('POST', `/api/companies/${selectedCompany.id}/agent-emails`, {
          agentType,
          instanceName: data.instanceName,
          emailAddress: data.emailAddress,
          isActive: true,
          customization: {},
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
          customization: {},
        });
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-instances', selectedCompany?.id, 'individual', agentType] });
      setCreateDialogOpen(false);
      setNewInstanceName('');
      setNewInstanceEmail('');
      setCreateError('');
      toast({
        title: 'Success',
        description: `New ${agentName} ${labelSingularLower} created successfully`,
      });
    },
    onError: async (error: any) => {
      let errorMessage = `Failed to create ${agentName} ${labelSingularLower}`;

      // Try to extract specific error message from server response
      if (error?.response) {
        try {
          const errorData = await error.response.json();
          if (errorData?.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // If parsing fails, use default message
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      setCreateError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  // Delete agent instance
  const deleteInstanceMutation = useMutation({
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
      toast({
        title: 'Success',
        description: `${agentName} ${labelSingularLower} deleted successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete ${agentName} ${labelSingularLower}`,
        variant: 'destructive',
      });
    },
  });

  // Update agent instance email
  const updateInstanceMutation = useMutation({
    mutationFn: async ({ instanceId, emailAddress }: { instanceId: number; emailAddress: string }) => {
      if (selectedCompany) {
        // Company mode
        await apiRequest('PUT', `/api/companies/${selectedCompany.id}/agent-emails/${instanceId}`, {
          emailAddress,
        });
      } else {
        // Individual mode
        await apiRequest('PATCH', `/api/user/agent-emails/${instanceId}`, {
          emailAddress,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-instances', selectedCompany?.id, 'individual', agentType] });
      setEditingInstanceId(null);
      setEditingEmail('');
      toast({
        title: 'Success',
        description: `${agentName} ${labelSingularLower} email updated successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update ${agentName} ${labelSingularLower} email`,
        variant: 'destructive',
      });
    },
  });

  const handleEditEmail = (instance: AgentInstance) => {
    setEditingInstanceId(instance.id);
    setEditingEmail(instance.emailAddress);
  };

  const handleSaveEmail = () => {
    if (editingInstanceId && editingEmail) {
      updateInstanceMutation.mutate({
        instanceId: editingInstanceId,
        emailAddress: editingEmail,
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingInstanceId(null);
    setEditingEmail('');
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmails(prev => new Set([...prev, email]));
      setTimeout(() => {
        setCopiedEmails(prev => {
          const next = new Set(prev);
          next.delete(email);
          return next;
        });
      }, 2000);
      toast({
        title: 'Copied!',
        description: 'Email address copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy email address',
        variant: 'destructive',
      });
    }
  };

  const generateDefaultEmail = () => {
    if (!newInstanceName) return '';
    
    if (selectedCompany) {
      // Company mode
      const sanitizedCompany = selectedCompany.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 15);
      
      const sanitizedInstance = newInstanceName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 10);
      
      return `${agentType}+${sanitizedCompany}-${sanitizedInstance}@inboxleap.com`;
    } else {
      // Individual mode: Check if this would be the primary instance
      const isPrimaryInstance = instances.length === 0 && (newInstanceName.toLowerCase() === 'primary' || newInstanceName.toLowerCase() === 'default');
      
      if (isPrimaryInstance) {
        // Use base email for default primary instance
        return `${agentType}@inboxleap.com`;
      } else {
        // Generate instance ID for non-primary instances
        const instanceId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        return `${agentType}+${instanceId}@inboxleap.com`;
      }
    }
  };

  React.useEffect(() => {
    if (newInstanceName && !newInstanceEmail) {
      setNewInstanceEmail(generateDefaultEmail());
    }
  }, [newInstanceName, selectedCompany]);

  // Clear error when dialog opens or user starts typing
  React.useEffect(() => {
    if (createDialogOpen) {
      setCreateError('');
    }
  }, [createDialogOpen]);

  const handleInstanceNameChange = (value: string) => {
    setNewInstanceName(value);
    setCreateError('');
  };

  const handleInstanceEmailChange = (value: string) => {
    setNewInstanceEmail(value);
    setCreateError('');
  };

  // For individual users, show simplified view with primary instance
  const primaryInstance = instances.length > 0 ? instances[0] : null;
  const hasMultipleInstances = instances.length > 1;
  const isIndividualMode = !selectedCompany;

  return (
    <div className="space-y-4">
      {/* Individual mode: Show primary instance info and option to create more */}
      {isIndividualMode && primaryInstance && !hasMultipleInstances ? (
        <Card className="bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 border border-gray-200 shadow-lg">
          <CardHeader className="pb-3 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 text-white rounded-t-lg">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg text-white">{agentName} Agent</CardTitle>
                <CardDescription className="text-white/90">
                  Your personal {agentName} agent is ready to help
                </CardDescription>
              </div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/20">
                    <Plus className="h-4 w-4 mr-2" />
                    Add {labelSingular}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 border border-gray-200 shadow-xl">
                  <DialogHeader className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 text-white p-6 -m-6 mb-6 rounded-t-lg">
                    <DialogTitle className="text-white font-semibold">Create Additional {agentName} {labelSingular}</DialogTitle>
                    <DialogDescription className="text-white/90">
                      Set up an additional {agentName} {labelSingularLower} with a custom email address.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="instanceName" className="text-gray-700 font-medium">{labelSingular} Name</Label>
                      <Input
                        id="instanceName"
                        placeholder="e.g., Work, Personal, Projects"
                        value={newInstanceName}
                        onChange={(e) => handleInstanceNameChange(e.target.value)}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emailAddress" className="text-gray-700 font-medium">Email Address</Label>
                      <Input
                        id="emailAddress"
                        placeholder="agent@inboxleap.com"
                        value={newInstanceEmail}
                        onChange={(e) => handleInstanceEmailChange(e.target.value)}
                        className={`border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${createError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {createError && (
                        <p className="text-xs text-red-600 mt-1">{createError}</p>
                      )}
                      <p className="text-xs text-gray-600">
                        This is the email address that will receive emails for this {agentName} {labelSingularLower}.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
                    <Button 
                      variant="outline" 
                      onClick={() => setCreateDialogOpen(false)}
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => createInstanceMutation.mutate({
                        instanceName: newInstanceName,
                        emailAddress: newInstanceEmail,
                      })}
                      disabled={!newInstanceName || !newInstanceEmail || createInstanceMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {createInstanceMutation.isPending ? 'Creating...' : `Create ${labelSingular}`}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50/80 to-purple-50/80 border border-blue-200/60 rounded-lg shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-gray-900">Primary {labelSingular}</span>
                    <Badge variant="default" className="text-xs bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-sm">Active</Badge>
                  </div>
                  {editingInstanceId === primaryInstance.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editingEmail}
                        onChange={(e) => setEditingEmail(e.target.value)}
                        className="text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        placeholder="agent@inboxleap.com"
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveEmail}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={updateInstanceMutation.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground break-all">
                      {primaryInstance.emailAddress}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  {editingInstanceId !== primaryInstance.id && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditEmail(primaryInstance)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyEmail(primaryInstance.emailAddress)}
                      >
                        {copiedEmails.has(primaryInstance.emailAddress) ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Send emails to this address to start conversations with your {agentName} agent.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Company mode or multiple instances: Show full management interface */
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">{agentName} {labelPlural}</h3>
              <p className="text-sm text-muted-foreground">
                {isIndividualMode 
                  ? `Manage your ${agentName} agent ${labelPluralLower}`
                  : `Manage multiple ${agentName} ${labelPluralLower} with custom email addresses`
                }
              </p>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add {labelSingular}
                </Button>
              </DialogTrigger>
          <DialogContent className="max-w-md bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 border border-gray-200 shadow-xl">
            <DialogHeader className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 text-white p-6 -m-6 mb-6 rounded-t-lg">
              <DialogTitle className="text-white font-semibold">Create New {agentName} {labelSingular}</DialogTitle>
              <DialogDescription className="text-white/90">
                Set up a new {agentName} {labelSingularLower} with a custom email address.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="instanceName" className="text-gray-700 font-medium">{labelSingular} Name</Label>
                <Input
                  id="instanceName"
                  placeholder="e.g., Sales, Support, Marketing"
                  value={newInstanceName}
                  onChange={(e) => handleInstanceNameChange(e.target.value)}
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailAddress" className="text-gray-700 font-medium">Email Address</Label>
                <Input
                  id="emailAddress"
                  placeholder="agent@inboxleap.com"
                  value={newInstanceEmail}
                  onChange={(e) => handleInstanceEmailChange(e.target.value)}
                  className={`border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${createError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
                {createError && (
                  <p className="text-xs text-red-600 mt-1">{createError}</p>
                )}
                <p className="text-xs text-gray-600">
                  This is the email address that will receive emails for this {agentName} {labelSingularLower}.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
              <Button 
                variant="outline" 
                onClick={() => setCreateDialogOpen(false)}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => createInstanceMutation.mutate({
                  instanceName: newInstanceName,
                  emailAddress: newInstanceEmail,
                })}
                disabled={!newInstanceName || !newInstanceEmail || createInstanceMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {createInstanceMutation.isPending ? 'Creating...' : `Create ${labelSingular}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
          </div>

          {isLoading ? (
        <Card className="bg-gradient-to-br from-white via-gray-50/50 to-white border border-gray-200 shadow-lg">
          <CardContent className="p-6">
            <div className="text-center text-gray-700 font-medium">Loading {labelPluralLower}...</div>
          </CardContent>
        </Card>
      ) : instances.length === 0 ? (
        <Card className="bg-gradient-to-br from-white via-gray-50/50 to-white border border-gray-200 shadow-lg">
          <CardContent className="p-6">
            <div className="text-center">
              <Mail className="h-12 w-12 mx-auto mb-4 text-gray-500" />
              <h3 className="text-lg font-semibold mb-2 text-gray-900">No {agentName} {labelPlural}</h3>
              <p className="mb-4 text-gray-700">Create your first {agentName} {labelSingularLower} to get started.</p>
              <Button 
                onClick={() => setCreateDialogOpen(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium shadow-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First {labelSingular}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {instances.map((instance: AgentInstance) => (
            <Card 
              key={instance.id} 
              className={`cursor-pointer transition-all duration-200 bg-gradient-to-br from-white via-gray-50/30 to-white border shadow-lg hover:shadow-xl ${
                selectedInstanceId === instance.id 
                  ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 ring-2 ring-blue-500/20' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onInstanceSelect?.(instance)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                      {instance.instanceName}
                      {instance.isDefault && (
                        <Badge variant="outline" className="text-xs uppercase tracking-wide">
                          Default
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="break-all text-gray-700 font-medium">
                      {instance.emailAddress}
                    </CardDescription>
                  </div>
                  <div className="flex space-x-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyEmail(instance.emailAddress);
                      }}
                      className="hover:bg-gray-100"
                    >
                      {copiedEmails.has(instance.emailAddress) ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-600" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteInstanceMutation.mutate(instance.id);
                      }}
                      className="hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <Badge 
                    variant={instance.isActive ? 'default' : 'secondary'}
                    className={instance.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}
                  >
                    {instance.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    Created {new Date(instance.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        )}
        </div>
      )}
    </div>
  );
};

export default AgentInstanceManager;
