
import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useAgentUsage } from "@/hooks/useAgentUsage";
import { useToast } from "@/hooks/use-toast";
import { getAgentById } from "@/config/agents";
import { apiRequest } from "@/lib/queryClient";
import { useCopilotContext } from "@/contexts/CopilotContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  RefreshCw,
  Mail,
  TrendingUp,
  BarChart3,
  MessageSquare,
  Settings,
  Plus,
  Copy,
  Check,
  Edit3,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import AgentInstanceManager from "@/components/AgentInstanceManager";
import DismissibleHint from "@/components/DismissibleHint";

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

interface T5TEmail {
  id: string | number;
  subject: string | null;
  sender: string | null;
  body?: string | null;
  recipients?: string[] | null;
  createdAt?: string;
  status?: string | null;
}

interface T5TInsight {
  id?: string;
  topic?: string;
  description?: string;
  urgency?: string;
  sentiment?: string;
  frequency?: number;
}

interface T5TIntelligenceResponse {
  instanceId: number;
  instanceName: string;
  instanceEmail: string;
  period: string;
  generatedAt: string;
  dataContext?: string;
  useVisibleData?: boolean;
  metrics?: {
    emailVolume?: number;
    participationRate?: number;
    sentimentScore?: number;
    alertCount?: number;
    insightsGenerated?: number;
  };
  insights?: T5TInsight[];
  trendingTopics?: T5TInsight[];
  keyFindings?: string[];
  summaryHighlights?: string[];
  executiveSummary?: string;
  recommendedAction?: string;
  dataSource?: {
    totalEmails?: number;
    analysisWindow?: string;
    confidence?: string;
    context?: string;
  };
  instanceIntelligence?: {
    metrics?: T5TIntelligenceResponse["metrics"];
    insights?: T5TInsight[];
    trendingTopics?: T5TInsight[];
    keyFindings?: string[];
    summaryHighlights?: string[];
    executiveSummary?: string;
    recommendedAction?: string;
    dataSource?: T5TIntelligenceResponse["dataSource"];
  };
  emailSpecificIntelligence?: unknown;
}

const INSTANCE_QUERY_KEY = ["t5t", "instances"] as const;

function generateEmailSuggestion(instanceName: string, user?: any): string {
  const trimmed = instanceName.trim();
  if (!trimmed) {
    return "";
  }

  // Create user identifier from user ID for primary instances only
  const userIdentifier = user?.id ? user.id.toString().slice(-8) : 'user';

  const normalized = trimmed.toLowerCase();
  if (normalized === "primary" || normalized === "default" || normalized === "main") {
    // Primary instances must be user-specific to avoid conflicts
    return `t5t+${userIdentifier}@inboxleap.com`;
  }

  // For custom instances, generate unique email with timestamp and random ID
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) {
    return "";
  }

  // Generate unique ID in frontend to show user the exact email they'll get
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  const uniqueId = `${timestamp}${random}`;

  return `t5t+${slug}-${uniqueId}@inboxleap.com`;
}

export default function T5TPage() {
  const { user } = useAuth();
  const { trackAgentUsage } = useAgentUsage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const agent = getAgentById("t5t");
  const { updateContext } = useCopilotContext();

  const [activeTab, setActiveTab] = useState<string>("intelligence");
  const [selectedInstance, setSelectedInstance] = useState<AgentInstance | null>(null);
  const [allInstancesSelected, setAllInstancesSelected] = useState<boolean>(false);
  const [instancesSidebarCollapsed, setInstancesSidebarCollapsed] = useState<boolean>(false);
  const [selectedEmail, setSelectedEmail] = useState<T5TEmail | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState<boolean>(false);
  const [newInstanceName, setNewInstanceName] = useState<string>("primary");
  const [newInstanceEmail, setNewInstanceEmail] = useState<string>("");
  const [emailManuallyEdited, setEmailManuallyEdited] = useState<boolean>(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const [editingInstance, setEditingInstance] = useState<AgentInstance | null>(null);
  const [editingEmail, setEditingEmail] = useState<string>("");

  const urlParams = new URLSearchParams(location.split("?")[1] || "");
  const instanceIdFromUrl = urlParams.get("instance");

  useEffect(() => {
    trackAgentUsage("t5t");
  }, [trackAgentUsage]);

  useEffect(() => {
    if (!createDialogOpen) {
      return;
    }
    if (!emailManuallyEdited) {
      setNewInstanceEmail(generateEmailSuggestion(newInstanceName, user));
    }
  }, [createDialogOpen, newInstanceName, emailManuallyEdited, user]);

  // Initialize email when user is available
  useEffect(() => {
    if (user && !newInstanceEmail) {
      setNewInstanceEmail(generateEmailSuggestion(newInstanceName, user));
    }
  }, [user, newInstanceName, newInstanceEmail]);

  const { data: instancesResponse, isLoading: instancesLoading, error: instancesError } = useQuery<{ instances: AgentInstance[] }>({
    queryKey: INSTANCE_QUERY_KEY,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/agent-instances/t5t");
      return response.json();
    },
    enabled: !!user,
    retry: 1,
    staleTime: 30_000,
  });

  const instances = instancesResponse?.instances ?? [];

  useEffect(() => {
    if (instances.length === 0) {
      setSelectedInstance(null);
      setAllInstancesSelected(false);
      setSelectedEmail(null);
      return;
    }

    if (instanceIdFromUrl) {
      const instanceFromUrl = instances.find((instance) => instance.id.toString() === instanceIdFromUrl);
      if (instanceFromUrl) {
        setSelectedInstance(instanceFromUrl);
        setAllInstancesSelected(false);
        // Save to localStorage
        localStorage.setItem('t5t-selected-instance-id', instanceFromUrl.id.toString());
        return;
      }
    }

    if (!selectedInstance || !instances.some((instance) => instance.id === selectedInstance.id)) {
      // Try to restore from localStorage first
      const savedInstanceId = localStorage.getItem('t5t-selected-instance-id');
      const savedInstance = savedInstanceId ? instances.find((instance) => instance.id.toString() === savedInstanceId) : null;

      const defaultInstance = savedInstance || (instances.find((instance) => instance.isDefault) ?? instances[0]);
      setSelectedInstance(defaultInstance);
      setAllInstancesSelected(false);
      // Save to localStorage
      localStorage.setItem('t5t-selected-instance-id', defaultInstance.id.toString());
    }
  }, [instances, instanceIdFromUrl, selectedInstance]);

  const selectedInstanceId = selectedInstance?.id ?? null;

  const emailsQuery = useQuery<{ emails: T5TEmail[] }, Error>({
    queryKey: ["t5t", "emails", selectedInstanceId ?? "none"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/t5t/emails/${selectedInstanceId}`);
      return response.json() as Promise<{ emails: T5TEmail[] }>;
    },
    enabled: !!selectedInstanceId && !allInstancesSelected,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  const intelligenceQuery = useQuery<T5TIntelligenceResponse, Error>({
    queryKey: ["t5t", "intelligence", selectedInstanceId ?? "none"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/t5t/instance-intelligence/${selectedInstanceId}`);
      return response.json() as Promise<T5TIntelligenceResponse>;
    },
    enabled: !!selectedInstanceId && !allInstancesSelected,
    refetchInterval: 90_000,
    staleTime: 45_000,
    retry: 1,
  });

  const emailsResponse = emailsQuery.data;
  const emailsFetching = emailsQuery.isFetching;
  const emailsLoading = emailsQuery.isLoading;
  const emailsError = emailsQuery.error;
  const refetchEmails = emailsQuery.refetch;

  const intelligenceResponse = intelligenceQuery.data;
  const intelligenceFetching = intelligenceQuery.isFetching;
  const intelligenceLoading = intelligenceQuery.isLoading;
  const intelligenceError = intelligenceQuery.error;
  const refetchIntelligence = intelligenceQuery.refetch;

  useEffect(() => {
    if (emailsError) {
      console.error("Failed to fetch T5T emails", emailsError);
      toast({
        title: "Unable to load emails",
        description: (emailsError as Error)?.message || "We couldn't retrieve the latest emails for this topic.",
        variant: "destructive",
      });
    }
  }, [emailsError, toast]);

  useEffect(() => {
    if (intelligenceError) {
      console.error("Failed to fetch T5T intelligence", intelligenceError);
      toast({
        title: "Unable to refresh insights",
        description: (intelligenceError as Error)?.message || "We couldn't generate insights for this topic.",
        variant: "destructive",
      });
    }
  }, [intelligenceError, toast]);

  // Update Copilot context when intelligence data is loaded
  useEffect(() => {
    if (intelligenceResponse && instances) {
      updateContext({
        type: 't5t',
        reportData: intelligenceResponse,
        companyAgents: instances,
        agentInfo: {
          name: 'Tanya',
          type: 'T5T Intelligence Agent',
          description: 'Analyzes team feedback and generates actionable insights from organizational communication.'
        }
      });
    }
  }, [intelligenceResponse, instances, updateContext]);

  useEffect(() => {
    if (!emailsResponse?.emails) {
      setSelectedEmail(null);
      return;
    }

    if (selectedEmail && emailsResponse?.emails.some((email) => email.id === selectedEmail.id)) {
      return;
    }

    setSelectedEmail(emailsResponse?.emails?.[0] ?? null);
  }, [emailsResponse, selectedEmail]);

  const insights = useMemo(() => {
    return (
      intelligenceResponse?.instanceIntelligence?.insights ||
      intelligenceResponse?.insights ||
      []
    );
  }, [intelligenceResponse]);

  const trendingTopics = useMemo(() => {
    return (
      intelligenceResponse?.instanceIntelligence?.trendingTopics ||
      intelligenceResponse?.trendingTopics ||
      []
    );
  }, [intelligenceResponse]);

  const keyFindings = useMemo(() => {
    return (
      intelligenceResponse?.instanceIntelligence?.keyFindings ||
      intelligenceResponse?.keyFindings ||
      []
    );
  }, [intelligenceResponse]);

  const executiveSummary = useMemo(() => {
    return (
      intelligenceResponse?.instanceIntelligence?.executiveSummary ||
      intelligenceResponse?.executiveSummary ||
      "Send emails to this T5T topic to generate intelligence insights."
    );
  }, [intelligenceResponse]);

  const summaryHighlights = useMemo(() => {
    return (
      intelligenceResponse?.instanceIntelligence?.summaryHighlights ||
      intelligenceResponse?.summaryHighlights ||
      []
    );
  }, [intelligenceResponse]);

  const recommendedAction = useMemo(() => {
    return (
      intelligenceResponse?.instanceIntelligence?.recommendedAction ||
      intelligenceResponse?.recommendedAction ||
      ''
    );
  }, [intelligenceResponse]);

  const displayKeyFindings = useMemo(() => {
    if (keyFindings.length === 0) {
      return [];
    }
    const seen = new Set<string>();
    [executiveSummary, recommendedAction, ...summaryHighlights].forEach((item) => {
      const trimmed = (item || '').trim().toLowerCase();
      if (trimmed) {
        seen.add(trimmed);
      }
    });
    return keyFindings.filter((finding: string) => {
      const trimmed = (finding || '').trim();
      if (!trimmed) {
        return false;
      }
      const normalized = trimmed.toLowerCase();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
  }, [executiveSummary, keyFindings, recommendedAction, summaryHighlights]);

  const topInsightItems = useMemo(() => {
    const items: Array<{ title: string; description?: string; badge?: string; meta?: string }> = [];

    insights.forEach((insight) => {
      if (items.length >= 5) {
        return;
      }
      const title = insight.topic?.trim() || 'Insight';
      const description = insight.description?.trim();
      const badge = insight.urgency ? insight.urgency.toUpperCase() : undefined;
      const metaParts: string[] = [];
      if (typeof insight.frequency === 'number' && insight.frequency > 0) {
        metaParts.push(`${insight.frequency} mention${insight.frequency === 1 ? '' : 's'}`);
      }
      if (insight.sentiment) {
        metaParts.push(`Sentiment: ${insight.sentiment}`);
      }
      if (!title && !description) {
        return;
      }
      items.push({
        title: title || 'Insight',
        description,
        badge,
        meta: metaParts.length ? metaParts.join(' | ') : undefined,
      });
    });

    displayKeyFindings.forEach((finding) => {
      if (items.length >= 5) {
        return;
      }
      const text = (finding || '').trim();
      if (!text) {
        return;
      }
      items.push({
        title: 'Key finding',
        description: text,
      });
    });

    trendingTopics.forEach((topic) => {
      if (items.length >= 5) {
        return;
      }
      const title = topic.topic?.trim();
      if (!title) {
        return;
      }
      const metaParts: string[] = [];
      if (typeof topic.frequency === 'number' && topic.frequency > 0) {
        metaParts.push(`${topic.frequency} mention${topic.frequency === 1 ? '' : 's'}`);
      }
      if (topic.sentiment) {
        metaParts.push(`Sentiment: ${topic.sentiment}`);
      }
      items.push({
        title,
        description: topic.description?.trim(),
        badge: topic.urgency ? topic.urgency.toUpperCase() : undefined,
        meta: metaParts.length ? metaParts.join(' | ') : undefined,
      });
    });

    return items.slice(0, 5);
  }, [displayKeyFindings, insights, trendingTopics]);

  const dataSourceInfo = useMemo(() => {
    return (
      intelligenceResponse?.instanceIntelligence?.dataSource ||
      intelligenceResponse?.dataSource ||
      undefined
    );
  }, [intelligenceResponse]);
  const createInstanceMutation = useMutation({
    mutationFn: async (payload: { instanceName: string; customEmail?: string }) => {
      const response = await apiRequest("POST", "/api/agent-instances", {
        agentType: "t5t",
        instanceName: payload.instanceName,
        customEmail: payload.customEmail,
      });
      return response.json() as Promise<{ instance: AgentInstance }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Topic created",
        description: `${data.instance.instanceName} is ready to receive emails.`,
      });
      setCreateDialogOpen(false);
      setNewInstanceName("primary");
      setNewInstanceEmail(generateEmailSuggestion("primary", user));
      setEmailManuallyEdited(false);
      queryClient.invalidateQueries({ queryKey: INSTANCE_QUERY_KEY });
      setSelectedInstance(data.instance);
      setAllInstancesSelected(false);
      setActiveTab("intelligence");
    },
    onError: (error: any) => {
      console.error("Failed to create T5T topic", error);
      toast({
        title: "Could not create topic",
        description: error?.message || "Please check the details and try again.",
        variant: "destructive",
      });
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: async (payload: { instanceId: number; emailAddress: string }) => {
      const response = await apiRequest("PUT", `/api/agent-instances/${payload.instanceId}/email`, {
        emailAddress: payload.emailAddress,
      });
      return response.json() as Promise<{ instance: AgentInstance }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Email updated",
        description: `${data.instance.emailAddress} is now active for ${data.instance.instanceName}.`,
      });
      queryClient.invalidateQueries({ queryKey: INSTANCE_QUERY_KEY });
      if (selectedInstance && selectedInstance.id === data.instance.id) {
        setSelectedInstance(data.instance);
      }
      setEditingInstance(null);
      setEditingEmail("");
    },
    onError: (error: any) => {
      console.error("Failed to update T5T topic email", error);
      toast({
        title: "Could not update topic email",
        description: error?.message || "Try a different email address.",
        variant: "destructive",
      });
    },
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: async (instanceId: number) => {
      const response = await apiRequest("DELETE", `/api/agent-instances/${instanceId}`);
      return response.json();
    },
    onSuccess: (_data, instanceId) => {
      toast({
        title: "Topic archived",
        description: "This Top 5 Things topic will no longer receive emails.",
      });
      queryClient.invalidateQueries({ queryKey: INSTANCE_QUERY_KEY });
      if (selectedInstance?.id === instanceId) {
        setSelectedInstance(null);
        setAllInstancesSelected(false);
        setSelectedEmail(null);
      }
    },
    onError: (error: any) => {
      console.error("Failed to delete T5T topic", error);
      toast({
        title: "Could not archive topic",
        description: error?.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleInstanceSelect = (instance: AgentInstance | null) => {
    setSelectedInstance(instance);
    setSelectedEmail(null);
    const isAll = instance === null;
    setAllInstancesSelected(isAll);
    if (!isAll) {
      setActiveTab("intelligence");
      // Save to localStorage
      if (instance) {
        localStorage.setItem('t5t-selected-instance-id', instance.id.toString());
      }
    } else {
      // Clear localStorage when "All Topics" is selected
      localStorage.removeItem('t5t-selected-instance-id');
    }
  };

  const handleRefresh = () => {
    if (!selectedInstanceId) {
      return;
    }
    refetchEmails();
    refetchIntelligence();
    toast({
      title: "Refreshing",
      description: "Retrieving the latest emails and insights...",
    });
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      toast({
        title: "Email copied",
        description: email,
      });
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch (error) {
      console.error("Failed to copy email", error);
      toast({
        title: "Clipboard unavailable",
        description: "Copy this email manually.",
        variant: "destructive",
      });
    }
  };

  const handleCreateInstance = () => {
    const trimmedName = newInstanceName.trim();
    if (!trimmedName) {
      toast({
        title: "Topic name required",
        description: "Give this Top 5 Things topic a unique name.",
        variant: "destructive",
      });
      return;
    }

    if (!/^[a-zA-Z0-9-_ ]{1,50}$/.test(trimmedName)) {
      toast({
        title: "Invalid topic name",
        description: "Use up to 50 letters, numbers, spaces, hyphens, or underscores.",
        variant: "destructive",
      });
      return;
    }

    const trimmedEmail = newInstanceEmail.trim();
    createInstanceMutation.mutate({
      instanceName: trimmedName,
      customEmail: trimmedEmail || undefined,
    });
  };

  const handleSaveEditedEmail = () => {
    if (!editingInstance) {
      return;
    }
    const trimmedEmail = editingEmail.trim();
    if (!trimmedEmail) {
      toast({
        title: "Email address required",
        description: "Each Top 5 Things topic needs a mailbox to receive intelligence emails.",
        variant: "destructive",
      });
      return;
    }
    updateEmailMutation.mutate({
      instanceId: editingInstance.id,
      emailAddress: trimmedEmail,
    });
  };

  const handleDeleteInstance = (instance: AgentInstance) => {
    const confirmed = window.confirm(
      `Archive topic ${instance.instanceName}? Emails sent to ${instance.emailAddress} will no longer be processed.`,
    );
    if (!confirmed) {
      return;
    }
    deleteInstanceMutation.mutate(instance.id);
  };

  const emails = emailsResponse?.emails ?? [];

  const selectedEmailReceivedAt = selectedEmail?.createdAt
    ? formatDistanceToNow(new Date(selectedEmail.createdAt), { addSuffix: true })
    : null;
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>Log in to manage Top 5 Things intelligence agents.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (instancesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>Loading Top 5 Things topics�</span>
        </div>
      </div>
    );
  }

  if (instancesError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Unable to load Top 5 Things</CardTitle>
            <CardDescription>
              {(instancesError as Error)?.message || "We couldn't fetch your Top 5 Things topics."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: INSTANCE_QUERY_KEY })}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Top 5 Things agent unavailable</CardTitle>
            <CardDescription>The Top 5 Things intelligence agent is not configured in this workspace.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="space-y-6">
        <DismissibleHint
          id="t5t-getting-started"
          title="Getting Started with Top 5 Things"
        >
          <p>
            Send emails to your Top 5 Things agent to generate intelligence insights. Use your unique T5T email addresses to start analyzing trends and patterns in your organization.
          </p>
        </DismissibleHint>
          {instances.length === 0 ? (
            <Card className="border-dashed border-2 py-16 text-center">
              <CardHeader className="items-center">
                <CardTitle>Create your first Top 5 Things intelligence agent</CardTitle>
                <CardDescription>
                  Generate organization-wide insights by routing emails through Top 5 Things.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Top 5 Things Topic
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col xl:flex-row gap-6">
              <div className={`${instancesSidebarCollapsed ? "w-16" : "w-72"} flex-shrink-0 transition-all duration-300`}>
                <Card className="h-full border-0 shadow-md bg-gradient-to-b from-slate-50 to-white">
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      {!instancesSidebarCollapsed && (
                        <CardTitle className="text-base font-semibold text-slate-900">Topics</CardTitle>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInstancesSidebarCollapsed(!instancesSidebarCollapsed)}
                        className="hover:bg-slate-100"
                      >
                        {instancesSidebarCollapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronLeft className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {!instancesSidebarCollapsed && (
                      <CardDescription className="text-xs text-muted-foreground">
                        Route team conversations through a dedicated Top 5 Things inbox.
                      </CardDescription>
                    )}
                  </CardHeader>
                  {!instancesSidebarCollapsed && (
                    <CardContent className="p-3">
                      <div className="space-y-2 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
                        <div
                          className={`p-3 rounded-lg border transition-all cursor-pointer ${
                            allInstancesSelected
                              ? "border-blue-500 bg-blue-50 shadow-sm"
                              : "border-transparent hover:bg-slate-50"
                          }`}
                          onClick={() => handleInstanceSelect(null)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-slate-900">All Topics</span>
                            <Badge variant="outline" className="text-xs">
                              {instances.length}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Combined overview across every Top 5 Things inbox.
                          </p>
                        </div>

                        {instances.map((instance) => {
                          const isSelected = selectedInstance?.id === instance.id;
                          const createdLabel = instance.createdAt
                            ? formatDistanceToNow(new Date(instance.createdAt), { addSuffix: true })
                            : null;
                          return (
                            <div
                              key={instance.id}
                              className={`p-3 rounded-lg border transition-all cursor-pointer group ${
                                isSelected
                                  ? "border-blue-500 bg-blue-50 shadow-sm"
                                  : "border-slate-200 hover:border-blue-300 hover:bg-blue-25"
                              }`}
                              onClick={() => handleInstanceSelect(instance)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-slate-900 truncate">
                                      {instance.instanceName}
                                    </span>
                                    {instance.isDefault && (
                                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                        Default
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate font-mono mt-1">
                                    {instance.emailAddress}
                                  </p>
                                  {createdLabel && (
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      Created {createdLabel}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleCopyEmail(instance.emailAddress);
                                    }}
                                    className="h-7 w-7"
                                  >
                                    {copiedEmail === instance.emailAddress ? (
                                      <Check className="h-3 w-3 text-green-600" />
                                    ) : (
                                      <Copy className="h-3 w-3 text-slate-600" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setEditingInstance(instance);
                                      setEditingEmail(instance.emailAddress);
                                    }}
                                    className="h-7 w-7"
                                  >
                                    <Edit3 className="h-3 w-3 text-slate-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDeleteInstance(instance);
                                    }}
                                    className="h-7 w-7 text-red-500 hover:text-red-600"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        <Button
                          variant="highlight"
                          onClick={() => {
                            setCreateDialogOpen(true);
                            setNewInstanceName(instances.length === 0 ? "primary" : "");
                            setNewInstanceEmail(
                              instances.length === 0 ? generateEmailSuggestion("primary", user) : "",
                            );
                            setEmailManuallyEdited(false);
                          }}
                          className="w-full flex items-center justify-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          New Instance
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>

              <div className="flex-1 space-y-6">
                {allInstancesSelected ? (
                  <Card className="border-dashed border-2">
                    <CardHeader>
                      <CardTitle>Select a Top 5 Things topic</CardTitle>
                      <CardDescription>
                        Choose a topic to review its emails and intelligence insights.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ) : selectedInstance ? (
                  <>
                    <Card className="shadow-sm">
                      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <CardTitle className="flex items-center gap-3 text-xl">
                            {selectedInstance.instanceName}
                            {selectedInstance.isDefault && (
                              <Badge variant="secondary" className="uppercase text-xs">
                                Default inbox
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-2">
                            <Mail className="h-4 w-4" />
                            <span className="font-mono text-sm">{selectedInstance.emailAddress}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-slate-900"
                              onClick={() => handleCopyEmail(selectedInstance.emailAddress)}
                              aria-label="Copy email address"
                            >
                              {copiedEmail === selectedInstance.emailAddress ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-slate-900"
                              onClick={() => {
                                setEditingInstance(selectedInstance);
                                setEditingEmail(selectedInstance.emailAddress);
                              }}
                              aria-label="Edit email address"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="highlight"
                            size="sm"
                            onClick={() => setInstancesSidebarCollapsed(false)}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Manage topics
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleRefresh}
                            disabled={emailsFetching || intelligenceFetching}
                          >
                            {emailsFetching || intelligenceFetching ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Refresh
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>

                    <Card className="shadow-sm">
                      <CardHeader>
                        <CardTitle>Top email analysis</CardTitle>
                        <CardDescription>
                          Top 5 Things highlights the five most impactful signals from recent conversations.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {intelligenceLoading ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Summarizing recent emails...</span>
                          </div>
                        ) : intelligenceError ? (
                          <div className="text-sm text-muted-foreground">
                            {(intelligenceError as Error)?.message || "Unable to load insights."}
                          </div>
                        ) : topInsightItems.length > 0 ? (
                          <div className="space-y-3">
                            {topInsightItems.map((item, index) => (
                              <div key={`${item.title}-${index}`} className="p-4 rounded-lg border border-slate-200">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-sm text-slate-900">{item.title}</p>
                                      {item.badge && (
                                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                          {item.badge}
                                        </Badge>
                                      )}
                                    </div>
                                    {item.description && (
                                      <p className="text-sm text-slate-700 leading-relaxed">{item.description}</p>
                                    )}
                                    {item.meta && (
                                      <p className="text-xs text-muted-foreground">{item.meta}</p>
                                    )}
                                  </div>
                                  <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Insights will appear once Top 5 Things processes a few conversations for this topic.
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                      <Card className="shadow-sm">
                        <CardHeader>
                          <CardTitle>Executive summary</CardTitle>
                          <CardDescription>
                            {intelligenceResponse?.generatedAt
                              ? `Generated ${formatDistanceToNow(new Date(intelligenceResponse.generatedAt), {
                                  addSuffix: true,
                                })}`
                              : "Latest Top 5 Things intelligence snapshot"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {intelligenceLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Building insights�</span>
                            </div>
                          ) : intelligenceError ? (
                            <div className="text-sm text-muted-foreground">
                              {(intelligenceError as Error)?.message || "Unable to load insights."}
                            </div>
                          ) : (
                            <>
                              {executiveSummary && (
                                <div className="space-y-1.5">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Summary
                                  </p>
                                  <p className="text-sm leading-relaxed text-slate-700">{executiveSummary}</p>
                                </div>
                              )}
                              {recommendedAction && (
                                <div className="space-y-1.5">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Suggested action
                                  </p>
                                  <p className="text-sm leading-relaxed text-slate-700">{recommendedAction}</p>
                                </div>
                              )}
                              {summaryHighlights.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Supporting notes
                                  </p>
                                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                                    {summaryHighlights.map((highlight: string, index: number) => (
                                      <li key={`summary-highlight-${index}`}>{highlight}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {displayKeyFindings.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                    Additional findings
                                  </p>
                                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                                    {displayKeyFindings.map((finding: string, index: number) => (
                                      <li key={`finding-${index}`}>{finding}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {trendingTopics.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Trending topics
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {trendingTopics.map((topic: T5TInsight, index: number) => (
                                      <Badge key={`${topic.topic}-${index}`} variant="outline" className="text-xs">
                                        {topic.topic || "Unnamed topic"}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {dataSourceInfo && (
                                <div className="pt-3 border-t border-slate-200 text-xs text-muted-foreground space-y-1">
                                  {(dataSourceInfo.analysisWindow || intelligenceResponse?.period) && (
                                    <div>Data window: {dataSourceInfo.analysisWindow || intelligenceResponse?.period}</div>
                                  )}
                                  {typeof dataSourceInfo.totalEmails === "number" && (
                                    <div>Total items analyzed: {dataSourceInfo.totalEmails}</div>
                                  )}
                                  <div>Confidence: {dataSourceInfo.confidence ?? "unknown"}</div>
                                  {dataSourceInfo.context && <div>{dataSourceInfo.context}</div>}
                                </div>
                              )}
                            </>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm">
                        <CardHeader>
                          <CardTitle>Email activity</CardTitle>
                          <CardDescription>
                            {emailsFetching || emailsLoading
                              ? "Refreshing Top 5 Things inbox"
                              : `${emails.length} recent emails`}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {emailsLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Loading emails�</span>
                            </div>
                          ) : emails.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                              No emails yet. Forward conversations to
                              {" "}
                              <span className="font-mono">{selectedInstance.emailAddress}</span>
                              {" "}
                              to generate intelligence.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {emails.map((email: T5TEmail) => {
                                const isActiveEmail = selectedEmail?.id === email.id;
                                const receivedAt = email.createdAt
                                  ? formatDistanceToNow(new Date(email.createdAt), { addSuffix: true })
                                  : "";
                                return (
                                  <button
                                    key={email.id}
                                    type="button"
                                    onClick={() => setSelectedEmail(email)}
                                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                      isActiveEmail
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-slate-200 hover:border-blue-300 hover:bg-blue-25"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-slate-900 truncate">
                                          {email.subject || "(no subject)"}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1 truncate">
                                          {email.sender || "Unknown sender"}
                                        </p>
                                        {email.body && (
                                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                            {email.body}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <span className="text-[10px] text-muted-foreground">{receivedAt}</span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="shadow-sm">
                      <CardHeader>
                        <CardTitle>Email details</CardTitle>
                        <CardDescription>
                          {selectedEmail
                            ? selectedEmailReceivedAt
                              ? `Received ${selectedEmailReceivedAt}`
                              : "Selected email"
                            : "Choose an email to inspect the content T5T analyzed."}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {selectedEmail ? (
                          <>
                            <div className="space-y-1">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Subject</p>
                              <p className="text-sm font-medium text-slate-900">
                                {selectedEmail.subject || "(no subject)"}
                              </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">From</p>
                                <p className="text-sm text-slate-700">
                                  {selectedEmail.sender || "Unknown sender"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Recipients</p>
                                <p className="text-sm text-slate-700">
                                  {selectedEmail.recipients && selectedEmail.recipients.length > 0
                                    ? selectedEmail.recipients.join(", ")
                                    : selectedInstance.emailAddress}
                                </p>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Body preview</p>
                              <div className="bg-slate-50 border border-slate-100 rounded-md p-3">
                                <pre className="text-sm whitespace-pre-wrap font-sans text-slate-700">
                                  {selectedEmail.body || "No message body captured."}
                                </pre>
                              </div>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Select an email from the activity panel to inspect Top 5 Things' input data.
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                      <CardHeader>
                        <CardTitle>Insights breakdown</CardTitle>
                        <CardDescription>
                          Top 5 Things highlights the most important patterns detected in your email stream.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {insights.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Insights will appear once Top 5 Things processes a few conversations for this topic.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {insights.map((insight: T5TInsight, index: number) => (
                              <div key={insight.id ?? index} className="p-4 rounded-lg border border-slate-200">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-semibold text-sm text-slate-900">
                                    {insight.topic || "Insight"}
                                  </p>
                                  {insight.urgency && (
                                    <Badge variant="outline" className="text-xs uppercase">
                                      {insight.urgency}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                                  {insight.description || "No description provided."}
                                </p>
                                <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                                  {typeof insight.frequency === "number" && (
                                    <span className="flex items-center gap-1">
                                      <TrendingUp className="h-3 w-3" />
                                      {insight.frequency} mentions
                                    </span>
                                  )}
                                  {insight.sentiment && (
                                    <span className="flex items-center gap-1">
                                      <MessageSquare className="h-3 w-3" />
                                      Sentiment: {insight.sentiment}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card className="border-dashed border-2">
                    <CardHeader>
                      <CardTitle>Select a Top 5 Things topic</CardTitle>
                      <CardDescription>Choose an instance from the sidebar to view insights.</CardDescription>
                    </CardHeader>
                  </Card>
                )}
              </div>
            </div>
          )}
      </div>
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) {
          setNewInstanceName("primary");
          setNewInstanceEmail(generateEmailSuggestion("primary", user));
          setEmailManuallyEdited(false);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Top 5 Things topic</DialogTitle>
            <DialogDescription>
              Give each team or workflow its own Top 5 Things inbox. The email address can be edited later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-1">
            <div className="space-y-2.5">
              <Label htmlFor="instanceName" className="text-sm font-medium">Topic name</Label>
              <Input
                id="instanceName"
                value={newInstanceName}
                onChange={(event) => {
                  setNewInstanceName(event.target.value);
                  if (!emailManuallyEdited) {
                    setNewInstanceEmail(generateEmailSuggestion(event.target.value, user));
                  }
                }}
                placeholder="e.g. marketing, customer-success"
                disabled={createInstanceMutation.isPending}
                className="h-10"
              />
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="instanceEmail" className="text-sm font-medium">Topic email address</Label>
              <Input
                id="instanceEmail"
                value={newInstanceEmail}
                onChange={(event) => {
                  setNewInstanceEmail(event.target.value);
                  setEmailManuallyEdited(true);
                }}
                placeholder="t5t+team@inboxleap.com"
                disabled={createInstanceMutation.isPending}
                className="h-10"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                We'll generate a unique email address based on your user account and topic name to ensure only relevant users can access your intelligence data.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={createInstanceMutation.isPending}
                className="h-10 px-4"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateInstance} 
                disabled={createInstanceMutation.isPending}
                className="h-10 px-4"
              >
                {createInstanceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create topic
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingInstance}
        onOpenChange={(open) => {
          if (!open) {
            setEditingInstance(null);
            setEditingEmail("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update T5T email</DialogTitle>
            <DialogDescription>
              Each T5T topic needs a unique inbox. Update the email address and share it with your team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-1">
            <div className="space-y-2.5">
              <Label className="text-sm font-medium">Email address</Label>
              <Input
                value={editingEmail}
                onChange={(event) => setEditingEmail(event.target.value)}
                disabled={updateEmailMutation.isPending}
                className="h-10"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingInstance(null);
                  setEditingEmail("");
                }}
                disabled={updateEmailMutation.isPending}
                className="h-10 px-4"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveEditedEmail} 
                disabled={updateEmailMutation.isPending}
                className="h-10 px-4"
              >
                {updateEmailMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}










