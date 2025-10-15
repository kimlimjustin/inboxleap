import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAgentUsage } from "@/hooks/useAgentUsage";
import { getAgentById } from "@/config/agents";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmailChainModal from "@/components/EmailChainModal";
import AgentInstanceManager from "@/components/AgentInstanceManager";
import {
  RefreshCw,
  Mail,
  Users,
  Calendar,
  MessageSquare,
  HelpCircle,
  FileText,
  Settings,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AgentInstance {
  id: number;
  userId?: string;
  agentType: string;
  instanceName: string;
  emailAddress: string;
  isActive: boolean;
  isDefault?: boolean;
  customization: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}


export default function FAQPage() {
  const { trackAgentUsage } = useAgentUsage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const agent = getAgentById("faq");
  const [location] = useLocation();

  const [selectedInstance, setSelectedInstance] = useState<AgentInstance | null>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [emailChainModalOpen, setEmailChainModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("instances");
  const [instanceManagerOpen, setInstanceManagerOpen] = useState(false);

  // Create topic dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("primary");
  const [newInstanceEmail, setNewInstanceEmail] = useState("faq@inboxleap.com");

  const urlParams = useMemo(() => new URLSearchParams(location.split("?")[1] || ""), [location]);
  const instanceIdFromUrl = urlParams.get("instance");
  const projectIdFromUrl = urlParams.get("project");

  const {
    data: instancesResponse,
    isLoading: instancesLoading,
    error: instancesError,
  } = useQuery({
    queryKey: ["/api/agent-instances/faq"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/agent-instances/faq");
      return response.json();
    },
  });

  const instances: AgentInstance[] = instancesResponse?.instances ?? [];

  const defaultInstance = useMemo(() => {
    if (!instances.length) {
      return null;
    }
    return instances.find((instance) => instance.isDefault) ?? instances[0];
  }, [instances]);

  useEffect(() => {
    if (!instances.length) {
      setSelectedInstance(null);
      return;
    }

    if (selectedInstance) {
      const updated = instances.find((instance) => instance.id === selectedInstance.id);
      if (updated) {
        if (updated !== selectedInstance) {
          setSelectedInstance(updated);
        }
      } else if (defaultInstance) {
        setSelectedInstance(defaultInstance);
      }
    }
  }, [instances, selectedInstance, defaultInstance]);

  useEffect(() => {
    if (!instances.length) {
      return;
    }

    if (instanceIdFromUrl) {
      const instanceFromUrl = instances.find((instance) => instance.id.toString() === instanceIdFromUrl);
      if (instanceFromUrl && (!selectedInstance || selectedInstance.id !== instanceFromUrl.id)) {
        setSelectedInstance(instanceFromUrl);
        setActiveTab("dashboard");
        // Save to localStorage
        localStorage.setItem('faq-selected-instance-id', instanceFromUrl.id.toString());
        return;
      }
    }

    if (!selectedInstance && defaultInstance) {
      // Try to restore from localStorage first
      const savedInstanceId = localStorage.getItem('faq-selected-instance-id');
      const savedInstance = savedInstanceId ? instances.find((instance) => instance.id.toString() === savedInstanceId) : null;

      const targetInstance = savedInstance || defaultInstance;
      setSelectedInstance(targetInstance);
      setActiveTab("dashboard");
      // Save to localStorage
      localStorage.setItem('faq-selected-instance-id', targetInstance.id.toString());
    }
  }, [instances, selectedInstance, defaultInstance, instanceIdFromUrl]);

  const { data: projectsResponse, refetch: refetchProjects } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/projects");
      return response.json();
    },
    enabled: true,
  });

  const projects = projectsResponse?.projects || [];

  const filteredProjects = useMemo(() => {
    if (!selectedInstance) {
      return [];
    }

    return projects.filter((project: any) => {
      if (!project || project.sourceEmail == null) {
        return false;
      }

      if (project.sourceEmail !== selectedInstance.emailAddress) {
        return false;
      }

      const hasKnowledgeSignals =
        !!project.sourceEmailSubject ||
        (!!project.topic && project.topic.toLowerCase().includes("faq")) ||
        (typeof project.emailCount === "number" && project.emailCount > 0);

      return project.type === "team" ? hasKnowledgeSignals : hasKnowledgeSignals;
    });
  }, [projects, selectedInstance]);

  useEffect(() => {
    if (selectedProject && filteredProjects.length > 0) {
      const exists = filteredProjects.some((project: any) => project.id === selectedProject.id);
      if (!exists) {
        setSelectedProject(null);
      }
    } else if (selectedProject && filteredProjects.length === 0) {
      setSelectedProject(null);
    }
  }, [filteredProjects, selectedProject]);

  useEffect(() => {
    if (!filteredProjects.length) {
      setSelectedProject(null);
      return;
    }

    if (projectIdFromUrl) {
      const projectFromUrl = filteredProjects.find((project: any) => project.id.toString() === projectIdFromUrl);
      if (projectFromUrl && (!selectedProject || selectedProject.id !== projectFromUrl.id)) {
        setSelectedProject(projectFromUrl);
        return;
      }
    }

    if (!selectedProject) {
      setSelectedProject(filteredProjects[0]);
    }
  }, [filteredProjects, projectIdFromUrl, selectedProject]);

  const s3RefreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/s3-refresh", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to trigger S3 refresh");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Refresh triggered",
        description: "Checking for new FAQ emails...",
      });
      setTimeout(() => refetchProjects(), 2000);
    },
    onError: () => {
      toast({
        title: "Refresh failed",
        description: "Failed to trigger email refresh",
        variant: "destructive",
      });
    },
  });


  const handleInstanceSelect = (instance: AgentInstance) => {
    setSelectedInstance(instance);
    setSelectedProject(null);
    setActiveTab("dashboard");
    // Save to localStorage
    localStorage.setItem('faq-selected-instance-id', instance.id.toString());
  };


  useEffect(() => {
    trackAgentUsage("faq");
  }, [trackAgentUsage]);

  if (!agent) {
    return <div>Agent not found</div>;
  }

  if (instancesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Loading FAQ topics...</p>
        </div>
      </div>
    );
  }

  if (instancesError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Unable to load FAQ topics</CardTitle>
            <CardDescription>
              {(instancesError as Error).message || "Please refresh the page and try again."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-6">
          {selectedInstance ? (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">FAQ Threads</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => s3RefreshMutation.mutate()}
                        disabled={s3RefreshMutation.isPending}
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${s3RefreshMutation.isPending ? "animate-spin" : ""}`}
                        />
                      </Button>
                    </div>
                    <CardDescription>
                      Questions sent to {selectedInstance.emailAddress}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="space-y-2 p-4">
                      {filteredProjects.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground space-y-2">
                          <HelpCircle className="h-8 w-8 mx-auto opacity-40" />
                          <p className="text-sm">No FAQ threads yet</p>
                          <p className="text-xs">
                            CC or forward questions to {selectedInstance.emailAddress}.
                          </p>
                        </div>
                      ) : (
                        filteredProjects.map((project: any) => (
                          <div
                            key={project.id}
                            className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                              selectedProject?.id === project.id
                                ? "border-cyan-500 bg-cyan-50"
                                : "border-border hover:border-muted"
                            }`}
                            onClick={() => setSelectedProject(project)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium text-sm truncate pr-2">{project.name}</h4>
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                FAQ
                              </Badge>
                            </div>
                            {project.sourceEmailSubject && (
                              <p className="text-xs text-muted-foreground mb-2 truncate">
                                ?? {project.sourceEmailSubject}
                              </p>
                            )}
                            {project.topic && (
                              <p className="text-xs text-muted-foreground mb-2 truncate">
                                ?? {project.topic}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {project.participantCount || 0} users
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {project.emailCount || 0} emails
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(project.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))
                      )}

                      <Button
                        variant="highlight"
                        onClick={() => setCreateDialogOpen(true)}
                        className="w-full flex items-center justify-center gap-2 mt-3"
                      >
                        <Plus className="h-4 w-4" />
                        New Topic
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-3">
                {selectedProject ? (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-xl">{selectedProject.name}</CardTitle>
                            <CardDescription>
                              Knowledge base context for {selectedInstance.instanceName}
                            </CardDescription>
                          </div>
                          <Button variant="outline" onClick={() => setEmailChainModalOpen(true)}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            View emails
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Knowledge base & SOPs
                        </CardTitle>
                        <CardDescription>
                          We are building automatic FAQ responses and SOP surfacing.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-12 text-muted-foreground space-y-3">
                          <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground/40" />
                          <h3 className="text-lg font-medium">Knowledge base coming soon</h3>
                          <p className="text-sm">
                            For now, review the email thread to keep track of answers.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="h-64 flex items-center justify-center">
                      <div className="text-center space-y-2 text-muted-foreground">
                        <h3 className="text-lg font-medium text-foreground">No thread selected</h3>
                        <p className="text-sm">
                          Choose an email thread to review FAQ activity.
                        </p>
                        <p className="text-xs">
                          Or send a question to {selectedInstance.emailAddress} to start a thread.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="h-64 flex items-center justify-center">
                <div className="text-center space-y-3 text-muted-foreground">
                  <HelpCircle className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <h3 className="text-lg font-medium text-foreground">No topic selected</h3>
                  <p className="text-sm">Create or select a topic to manage FAQ responses.</p>
                  <Button variant="highlight" onClick={() => setCreateDialogOpen(true)}>Manage topics</Button>
                </div>
              </CardContent>
            </Card>
          )}
      </div>

      <EmailChainModal
        isOpen={emailChainModalOpen}
        onClose={() => setEmailChainModalOpen(false)}
        projectId={selectedProject?.id}
        projectName={selectedProject?.name}
      />

      {/* Create Topic Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create FAQ topic</DialogTitle>
            <DialogDescription>
              Create a new topic for managing FAQ and knowledge base responses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-1">
            <div className="space-y-2.5">
              <Label htmlFor="instanceName" className="text-sm font-medium">Topic name</Label>
              <Input
                id="instanceName"
                value={newInstanceName}
                onChange={(event) => setNewInstanceName(event.target.value)}
                placeholder="e.g. support, help-desk"
                className="h-10"
              />
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="instanceEmail" className="text-sm font-medium">Topic email address</Label>
              <Input
                id="instanceEmail"
                value={newInstanceEmail}
                onChange={(event) => setNewInstanceEmail(event.target.value)}
                placeholder="faq+support@inboxleap.com"
                className="h-10"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                className="h-10 px-4"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // TODO: Implement create topic functionality
                  setCreateDialogOpen(false);
                }}
                className="h-10 px-4"
              >
                Create topic
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
