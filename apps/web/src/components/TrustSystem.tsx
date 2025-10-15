import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Shield, ShieldCheck, ShieldX, UserX, Users, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface TrustRelationship {
  id: number;
  userId: string;
  trustedUserId: string;
  trustStatus: 'trusted' | 'blocked' | 'pending';
  createdAt: string;
  updatedAt: string;
}

interface PendingDecision {
  assignerId: string;
  assignerName: string;
  assignerEmail: string;
  notification: {
    id: string;
    message: string;
    type: string;
    createdAt: string;
  };
}

export default function TrustSystem() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('relationships');

  // Fetch trust relationships
  const { data: relationshipsData, isLoading: relationshipsLoading } = useQuery({
    queryKey: ['/api/trust/relationships'],
    retry: false,
  });

  // Fetch pending trust decisions
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['/api/trust/pending'],
    retry: false,
  });

  // Process trust decision mutation
  const processTrustDecision = useMutation({
    mutationFn: async ({ assignerId, decision }: { assignerId: string; decision: 'trust' | 'block' }) => {
      const response = await fetch('/api/trust/decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ assignerId, decision }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to process trust decision');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Trust Decision Processed",
        description: data.message,
      });
      // Refresh both queries
      queryClient.invalidateQueries({ queryKey: ['/api/trust/relationships'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trust/pending'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to process trust decision',
        variant: "destructive",
      });
    },
  });

  const handleTrustDecision = (assignerId: string, decision: 'trust' | 'block') => {
    processTrustDecision.mutate({ assignerId, decision });
  };

  const relationships = (relationshipsData as any)?.relationships || [];
  const pendingDecisions = (pendingData as any)?.pendingDecisions || [];

  const getTrustStatusBadge = (status: string) => {
    switch (status) {
      case 'trusted':
        return <Badge variant="default" className="bg-green-100 text-green-700 border-green-200"><ShieldCheck className="w-3 h-3 mr-1" />Trusted</Badge>;
      case 'blocked':
        return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200"><ShieldX className="w-3 h-3 mr-1" />Blocked</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trust Management</h1>
          <p className="text-gray-600">Manage who can assign tasks to you and create projects on your behalf</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="relationships" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Trust Relationships ({relationships.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Pending Decisions ({pendingDecisions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="relationships" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Your Trust Relationships
              </CardTitle>
              <CardDescription>
                People you trust to assign tasks and create projects on your behalf
              </CardDescription>
            </CardHeader>
            <CardContent>
              {relationshipsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading trust relationships...</p>
                </div>
              ) : relationships.length === 0 ? (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    You haven't established any trust relationships yet. When someone assigns tasks to you via email, you'll be prompted to trust or block them.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {relationships.map((relationship: TrustRelationship) => (
                    <div key={relationship.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium">User ID: {relationship.trustedUserId}</p>
                          <p className="text-sm text-gray-500">
                            Created {new Date(relationship.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getTrustStatusBadge(relationship.trustStatus)}
                        {relationship.trustStatus === 'trusted' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTrustDecision(relationship.trustedUserId, 'block')}
                            disabled={processTrustDecision.isPending}
                          >
                            <UserX className="w-4 h-4 mr-1" />
                            Block
                          </Button>
                        )}
                        {relationship.trustStatus === 'blocked' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTrustDecision(relationship.trustedUserId, 'trust')}
                            disabled={processTrustDecision.isPending}
                          >
                            <ShieldCheck className="w-4 h-4 mr-1" />
                            Trust
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Pending Trust Decisions
              </CardTitle>
              <CardDescription>
                People waiting for your trust decision before they can assign tasks to you
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading pending decisions...</p>
                </div>
              ) : pendingDecisions.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    No pending trust decisions. When someone new tries to assign you tasks, they'll appear here for you to decide.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {pendingDecisions.map((decision: PendingDecision) => (
                    <div key={decision.assignerId} className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                              <Users className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                              <p className="font-medium">{decision.assignerName || 'Unknown User'}</p>
                              <p className="text-sm text-gray-600">{decision.assignerEmail}</p>
                            </div>
                          </div>
                          
                          <div className="bg-white p-3 rounded border mb-3">
                            <p className="text-sm">{decision.notification.message}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(decision.notification.createdAt).toLocaleString()}
                            </p>
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-3">
                            This person wants to assign tasks to you. Do you trust them?
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleTrustDecision(decision.assignerId, 'trust')}
                          disabled={processTrustDecision.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Trust & Allow
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleTrustDecision(decision.assignerId, 'block')}
                          disabled={processTrustDecision.isPending}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Block
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}