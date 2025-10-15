import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAgentUsage } from "@/hooks/useAgentUsage";
import { useToast } from "@/hooks/use-toast";
import { getAgentById } from "@/config/agents";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmailChainModal from "@/components/EmailChainModal";
import AgentInstanceManager from "@/components/AgentInstanceManager";
import DismissibleHint from "@/components/DismissibleHint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2,
  Paperclip,
  Settings,
  Mail,
  RefreshCw,
  FileText,
  Clock,
  FolderOpen,
  Plus,
  X,
} from "lucide-react";

const INSTANCE_QUERY_KEY = ["alex", "instances"] as const;

interface AgentInstance {
  id: number;
  userId?: string;
  companyId?: number;
  agentType: string;
  instanceName: string;
  emailAddress: string;
  isDefault?: boolean;
  isActive: boolean;
  customization: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}


export default function AlexPage() {
  const { trackAgentUsage } = useAgentUsage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const agent = getAgentById("alex");
  const [location] = useLocation();

  const [activeTab, setActiveTab] = useState<string>("attachments");
  const [selectedInstance, setSelectedInstance] = useState<AgentInstance | null>(null);
  const [allInstancesSelected, setAllInstancesSelected] = useState<boolean>(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [emailChainModalOpen, setEmailChainModalOpen] = useState(false);
  const [instanceManagerOpen, setInstanceManagerOpen] = useState(false);

  // Create workspace dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("primary");
  const [newInstanceEmail, setNewInstanceEmail] = useState("alex@inboxleap.com");

  const urlParams = useMemo(() => new URLSearchParams(location.split("?")[1] || ""), [location]);
  const instanceIdFromUrl = urlParams.get("instance");
  const projectIdFromUrl = urlParams.get("project");
  const {
    data: instancesResponse,
    isLoading: instancesLoading,
    error: instancesError,
  } = useQuery<{ instances: AgentInstance[] }>({
    queryKey: INSTANCE_QUERY_KEY,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/agent-instances/alex");
      return response.json();
    },
    retry: 1,
    staleTime: 30_000,
  });

  const instances = instancesResponse?.instances ?? [];

  const primaryInstance = useMemo(() => {
    if (!instances.length) {
      return null;
    }
    return instances.find((instance) => instance.isDefault) ?? instances[0];
  }, [instances]);

  useEffect(() => {
    if (!instances.length) {
      setSelectedInstance(null);
      setSelectedProject(null);
      return;
    }

    if (instanceIdFromUrl) {
      const match = instances.find((instance) => instance.id.toString() === instanceIdFromUrl);
      if (match) {
        setSelectedInstance(match);
        setAllInstancesSelected(false);
        setActiveTab("attachments");
        // Save to localStorage
        localStorage.setItem('alex-selected-instance-id', match.id.toString());
        return;
      }
    }

    if (!selectedInstance && primaryInstance) {
      // Try to restore from localStorage first
      const savedInstanceId = localStorage.getItem('alex-selected-instance-id');
      const savedInstance = savedInstanceId ? instances.find((instance) => instance.id.toString() === savedInstanceId) : null;

      const targetInstance = savedInstance || primaryInstance;
      setSelectedInstance(targetInstance);
      setAllInstancesSelected(false);
      // Save to localStorage
      localStorage.setItem('alex-selected-instance-id', targetInstance.id.toString());
    }
  }, [instances, primaryInstance, instanceIdFromUrl, selectedInstance]);

  useEffect(() => {
    if (!instancesLoading && instances.length === 0) {
      setActiveTab("instances");
    }
  }, [instancesLoading, instances.length]);

  const handleInstanceSelect = (instance: AgentInstance | null) => {
    setSelectedInstance(instance);
    setAllInstancesSelected(instance === null);
    setSelectedProject(null);
    setActiveTab("attachments");

    // Save to localStorage
    if (instance) {
      localStorage.setItem('alex-selected-instance-id', instance.id.toString());
    } else {
      // Clear localStorage when "All workspaces" is selected
      localStorage.removeItem('alex-selected-instance-id');
    }
  };

  const {
    data: projectsResponse,
    isLoading: projectsLoading,
    isFetching: projectsFetching,
    error: projectsError,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/projects");
      return response.json();
    },
    staleTime: 60_000,
  });

  const projects = projectsResponse?.projects ?? [];

  const projectsWithAttachments = useMemo(() => {
    return projects.filter((project: any) => {
      const attachmentCount = Array.isArray(project.attachments)
        ? project.attachments.length
        : project.attachmentCount ?? 0;
      return attachmentCount > 0;
    });
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (allInstancesSelected || !selectedInstance) {
      return projectsWithAttachments;
    }
    return projectsWithAttachments.filter((project: any) => project.sourceEmail === selectedInstance.emailAddress);
  }, [projectsWithAttachments, selectedInstance, allInstancesSelected]);

  useEffect(() => {
    if (!filteredProjects.length) {
      setSelectedProject(null);
      return;
    }

    if (projectIdFromUrl) {
      const match = filteredProjects.find((project: any) => project.id.toString() === projectIdFromUrl);
      if (match) {
        setSelectedProject(match);
        return;
      }
    }

    if (!selectedProject || !filteredProjects.some((project: any) => project.id === selectedProject.id)) {
      setSelectedProject(filteredProjects[0]);
    }
  }, [filteredProjects, projectIdFromUrl, selectedProject]);

  const attachmentMetrics = useMemo(() => {
    if (filteredProjects.length === 0) {
      return {
        totalThreads: 0,
        totalAttachments: 0,
        uniqueContributors: 0,
        lastUpdatedLabel: "No activity yet",
      };
    }

    const attachmentsProcessed = filteredProjects.reduce((total: number, project: any) => {
      const attachments = Array.isArray(project.attachments)
        ? project.attachments.length
        : project.attachmentCount ?? 0;
      return total + attachments;
    }, 0);

    const uniqueContributors = new Set(
      filteredProjects.map((project: any) => project.createdBy || project.sourceEmail || project.ownerEmail || "unknown")
    ).size;

    const latestDate = filteredProjects.reduce((latest: Date | null, project: any) => {
      const dateString = project.updatedAt || project.createdAt;
      if (!dateString) {
        return latest;
      }
      const value = new Date(dateString);
      if (!latest || value > latest) {
        return value;
      }
      return latest;
    }, null);

    return {
      totalThreads: filteredProjects.length,
      totalAttachments: attachmentsProcessed,
      uniqueContributors,
      lastUpdatedLabel: latestDate ? latestDate.toLocaleString() : "No recent updates",
    };
  }, [filteredProjects]);

  const handleRefresh = () => {
    refetchProjects();
    queryClient.invalidateQueries({ queryKey: INSTANCE_QUERY_KEY });
  };

  useEffect(() => {
    trackAgentUsage("alex");
  }, [trackAgentUsage]);

  if (!agent) {
    return <div className="min-h-screen flex items-center justify-center">Agent not found</div>;
  }

  if (instancesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Loading Document Analyzer workspaces...</p>
        </div>
      </div>
    );
  }

  if (instancesError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Unable to load Document Analyzer workspaces</CardTitle>
            <CardDescription>
              {(instancesError as Error).message || "Please refresh the page and try again."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: INSTANCE_QUERY_KEY })}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const additionalInstances = instances.filter((instance) => instance.id !== primaryInstance?.id);

  const workspaceTitle = allInstancesSelected
    ? "All attachment workspaces"
    : selectedInstance?.instanceName ?? "Select a workspace";

  const workspaceEmail = allInstancesSelected
    ? "Any Document Analyzer inbox"
    : selectedInstance?.emailAddress ?? "Choose a workspace to begin";

  const attachmentsForSelectedProject = Array.isArray(selectedProject?.attachments)
    ? selectedProject.attachments
    : [];

  const attachmentCountForInstance = (instance: AgentInstance) =>
    projectsWithAttachments.filter((project: any) => project.sourceEmail === instance.emailAddress).length;
  return (
    <div className="p-6">
      <div className="space-y-6">
        <DismissibleHint
          id="alex-getting-started"
          title="Getting Started with Document Analyzer"
        >
          <p>
            Forward emails with attachments to <strong>alex@inboxleap.com</strong> to automatically analyze documents, extract key information, and summarize content from PDFs, spreadsheets, images, and more.
          </p>
        </DismissibleHint>
          {instances.length === 0 ? (
            <Card className="border-dashed border-2 py-16 text-center">
              <CardHeader className="items-center">
                <CardTitle>Create your first Document Analyzer workspace</CardTitle>
                <CardDescription>
                  Route emails with attachments to alex@inboxleap.com to generate summaries and insights.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button onClick={() => setActiveTab("instances")}>
                  <Plus className="h-4 w-4 mr-2" />
                  New workspace
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="shadow-sm">
                <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-3 text-xl">
                      {workspaceTitle}
                      {!allInstancesSelected && selectedInstance?.isDefault && (
                        <Badge variant="secondary" className="uppercase text-xs">Default</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="font-mono">{workspaceEmail}</span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setActiveTab("instances")}>
                      <Settings className="h-4 w-4 mr-2" />
                      Manage workspaces
                    </Button>
                    <Button size="sm" onClick={handleRefresh} disabled={projectsFetching}>
                      {projectsFetching ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Refresh data
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Card className="shadow-sm border bg-orange-50">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-xs uppercase tracking-wide text-orange-600">Threads processed</CardDescription>
                        <CardTitle className="text-3xl text-orange-700">{attachmentMetrics.totalThreads}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="shadow-sm border">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-xs uppercase tracking-wide text-slate-500">Attachments analyzed</CardDescription>
                        <CardTitle className="text-3xl">{attachmentMetrics.totalAttachments}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="shadow-sm border">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-xs uppercase tracking-wide text-slate-500">Contributors</CardDescription>
                        <CardTitle className="text-3xl">{attachmentMetrics.uniqueContributors}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="shadow-sm border">
                      <CardHeader className="pb-2 flex items-start gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <CardDescription className="text-xs uppercase tracking-wide text-slate-500">Last updated</CardDescription>
                          <CardTitle className="text-sm">{attachmentMetrics.lastUpdatedLabel}</CardTitle>
                        </div>
                      </CardHeader>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,300px)_minmax(0,2fr)]">
                <Card className="shadow-sm border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-orange-900">
                      <Paperclip className="h-5 w-5 text-orange-600" />
                      Workspaces
                    </CardTitle>
                    <CardDescription>Select a workspace to filter attachment threads.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handleInstanceSelect(null)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        allInstancesSelected
                          ? 'border-orange-400 bg-orange-50 text-orange-900 shadow-sm'
                          : 'border-border hover:border-orange-200 hover:bg-orange-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">All workspaces</div>
                        <Badge variant="outline" className="text-xs">{projectsWithAttachments.length}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">View attachments across every Document Analyzer workspace.</p>
                    </button>
                    {instances.map((instance) => (
                      <button
                        key={instance.id}
                        type="button"
                        onClick={() => handleInstanceSelect(instance)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          !allInstancesSelected && selectedInstance?.id === instance.id
                            ? 'border-orange-400 bg-orange-50 text-orange-900 shadow-sm'
                            : 'border-border hover:border-orange-200 hover:bg-orange-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">{instance.instanceName}</div>
                          <Badge variant="outline" className="text-xs">{attachmentCountForInstance(instance)}</Badge>
                        </div>
                        <p className="text-xs font-mono text-muted-foreground truncate mt-1">{instance.emailAddress}</p>
                      </button>
                    ))}

                    <Button
                      variant="highlight"
                      onClick={() => setCreateDialogOpen(true)}
                      className="w-full flex items-center justify-center gap-2 mt-3"
                    >
                      <Plus className="h-4 w-4" />
                      New Workspace
                    </Button>
                  </CardContent>
                </Card>

                <div className="grid gap-6">
                  <Card className="shadow-sm border">
                    <CardHeader className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FolderOpen className="h-5 w-5 text-orange-600" />
                          Attachment threads
                        </CardTitle>
                        <CardDescription>
                          {filteredProjects.length} threads with attachments
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[360px] overflow-y-auto">
                      {projectsLoading ? (
                        <div className="py-24 text-center text-muted-foreground">Loading threads...</div>
                      ) : projectsError ? (
                        <div className="py-24 text-center text-muted-foreground">
                          Unable to load threads. Try refreshing.
                        </div>
                      ) : filteredProjects.length === 0 ? (
                        <div className="py-24 text-center text-muted-foreground">
                          No attachment threads found for this selection.
                        </div>
                      ) : (
                        filteredProjects.map((project: any) => {
                          const attachmentTotal = Array.isArray(project.attachments)
                            ? project.attachments.length
                            : project.attachmentCount ?? 0;
                          return (
                            <div
                              key={project.id}
                              onClick={() => setSelectedProject(project)}
                              className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                                selectedProject?.id === project.id
                                  ? 'border-orange-400 bg-orange-50'
                                  : 'border-border hover:border-orange-200 hover:bg-orange-50'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm text-foreground truncate">{project.name}</p>
                                  {project.topic && (
                                    <p className="text-xs text-muted-foreground mt-1 truncate">{project.topic}</p>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {attachmentTotal} files
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3">
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {project.emailCount || 0} emails
                                </span>
                                {project.createdAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(project.createdAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border">
                    <CardHeader className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-orange-600" />
                          Attachment details
                        </CardTitle>
                        <CardDescription>
                          {selectedProject
                            ? `Review attachments from ${selectedProject.name}`
                            : 'Select a thread to review its attachments and open the full email chain.'}
                        </CardDescription>
                      </div>
                      {selectedProject && (
                        <Button variant="outline" size="sm" onClick={() => setEmailChainModalOpen(true)}>
                          <Mail className="h-4 w-4 mr-2" />
                          View email chain
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedProject ? (
                        attachmentsForSelectedProject.length > 0 ? (
                          <div className="space-y-3">
                            {attachmentsForSelectedProject.map((attachment: any, index: number) => (
                              <div
                                key={attachment.id ?? index}
                                className="p-3 rounded-lg border bg-orange-50/60 border-orange-200 flex items-center justify-between"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-orange-900 truncate">
                                    {attachment.fileName || `Attachment ${index + 1}`}
                                  </p>
                                  <p className="text-xs text-orange-700">
                                    {attachment.contentType || 'File'}
                                    {attachment.size ? ` � ${Math.round(attachment.size / 1024)} KB` : ''}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="bg-orange-500 text-white">
                                  {attachment.status || 'Ready'}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-10 text-center text-muted-foreground bg-muted/40 rounded-lg">
                            This thread does not include attachments that Document Analyzer could extract.
                          </div>
                        )
                      ) : (
                        <div className="py-12 text-center text-muted-foreground">
                          Choose a thread to preview its attachments.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
      </div>

      <EmailChainModal
        isOpen={emailChainModalOpen}
        onClose={() => setEmailChainModalOpen(false)}
        projectId={selectedProject?.id ?? null}
        projectName={selectedProject?.name}
      />

      {/* Create Workspace Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Document Analyzer workspace</DialogTitle>
            <DialogDescription>
              Create a new workspace for processing email attachments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-1">
            <div className="space-y-2.5">
              <Label htmlFor="instanceName" className="text-sm font-medium">Workspace name</Label>
              <Input
                id="instanceName"
                value={newInstanceName}
                onChange={(event) => setNewInstanceName(event.target.value)}
                placeholder="e.g. marketing, documents"
                className="h-10"
              />
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="instanceEmail" className="text-sm font-medium">Workspace email address</Label>
              <Input
                id="instanceEmail"
                value={newInstanceEmail}
                onChange={(event) => setNewInstanceEmail(event.target.value)}
                placeholder="alex+team@inboxleap.com"
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
                  // TODO: Implement create workspace functionality
                  setCreateDialogOpen(false);
                }}
                className="h-10 px-4"
              >
                Create workspace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
