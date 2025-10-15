import React, { useEffect, useState } from "react";
import { useAgentUsage } from "@/hooks/useAgentUsage";
import { useAgentInstances } from "@/hooks/useAgentInstances";
import { getAgentById } from "@/config/agents";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AgentInstanceManager from "@/components/AgentInstanceManager";
import { PollingDashboardPage } from "@/pages/polling-dashboard";
import { Vote, Settings, Users, BarChart3, MessageSquare } from "lucide-react";

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

export default function PollyPage() {
  const { trackAgentUsage } = useAgentUsage();
  const agent = getAgentById('polly');
  const { instances, primaryInstance, hasInstances, isCompanyMode, companyName } = useAgentInstances('polly');
  const [selectedInstance, setSelectedInstance] = useState<AgentInstance | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Set default instance on load
  useEffect(() => {
    if (!selectedInstance && primaryInstance) {
      setSelectedInstance(primaryInstance);
      setActiveTab("dashboard");
    }
  }, [primaryInstance, selectedInstance]);

  const handleInstanceSelect = (instance: AgentInstance | null) => {
    setSelectedInstance(instance);
    if (instance) {
      setActiveTab("dashboard");
    }
  };

  // Only switch to instances tab if explicitly needed
  useEffect(() => {
    const shouldShowInstances = !hasInstances && !primaryInstance && isCompanyMode;
    if (shouldShowInstances && activeTab !== "instances") {
      setActiveTab("instances");
    }
  }, [hasInstances, primaryInstance, isCompanyMode, activeTab]);

  useEffect(() => {
    trackAgentUsage('polly');
  }, [trackAgentUsage]);

  if (!agent) {
    return <div>Agent not found</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50/30 to-rose-50/20">
      {/* Polling Hero */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-700 text-white">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center px-2">
              <Vote className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">
                {agent.name} Polling Station
              </h1>
              <p className="text-xl text-purple-100">
                AI-powered surveys and team feedback collection through email
              </p>
            </div>
          </div>
          
          {isCompanyMode && companyName && (
            <div className="text-center mb-8">
              <Badge variant="outline" className="bg-white/10 border-white/30 text-white">
                <Users className="w-4 h-4 mr-2" />
                {companyName}
              </Badge>
            </div>
          )}
          
          {/* Polling Features */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-400/20 rounded-xl flex items-center justify-center px-1">
                  <Vote className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Smart Polls</h3>
                  <p className="text-purple-200 text-sm">Email-based voting</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-pink-400/20 rounded-xl flex items-center justify-center px-1">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Real-time Results</h3>
                  <p className="text-pink-200 text-sm">Live feedback tracking</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-rose-400/20 rounded-xl flex items-center justify-center px-1">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Team Insights</h3>
                  <p className="text-rose-200 text-sm">Automated analysis</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-2 shadow-lg border border-border/20 mb-8">
            <TabsList className="grid w-full grid-cols-2 bg-transparent gap-2">
              <TabsTrigger 
                value="instances" 
                className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl transition-all duration-200 px-4"
              >
                <Settings className="h-4 w-4" />
                Setup & Topics
              </TabsTrigger>
              <TabsTrigger 
                value="dashboard" 
                disabled={!selectedInstance} 
                className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl transition-all duration-200 px-4"
              >
                <Vote className="h-4 w-4" />
                Polling Dashboard
                {selectedInstance && (
                  <Badge variant="secondary" className="ml-1 text-xs bg-white/20 text-white border-white/30">
                    {selectedInstance.instanceName}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

        <TabsContent value="instances" className="space-y-6">
          <AgentInstanceManager
            agentType="polly"
            agentName="Polly"
            entityLabel={{ singular: "Topic", plural: "Topics" }}
            onInstanceSelect={handleInstanceSelect}
            selectedInstanceId={selectedInstance?.id}
          />
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-6">
          {selectedInstance ? (
            <PollingDashboardPage selectedAgentId={selectedInstance.id} />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-muted-foreground">
                  <Vote className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                  <h3 className="text-lg font-medium mb-2">No Topic Selected</h3>
                  <p className="mb-4">Please select or create a Polly topic to continue.</p>
                  <Button onClick={() => setActiveTab("instances")}>
                    Manage Topics
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}