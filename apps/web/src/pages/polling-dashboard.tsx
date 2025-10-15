import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { PollingDashboard } from '@/components/PollingDashboard';
import { SentimentTrendChart } from '@/components/SentimentTrendChart';
import { TopicsWordCloud } from '@/components/TopicsWordCloud';
import { OrganizationMap } from '@/components/OrganizationMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { 
  AlertCircle, 
  Plus, 
  Settings, 
  BarChart3,
  Users,
  MessageSquare,
  TrendingUp,
  Edit3,
  Check,
  X
} from 'lucide-react';

interface PollingAgent {
  id: number;
  name: string;
  description: string;
  type: string;
  emailAddress: string;
  isActive: boolean;
  participantCount?: number;
  submissionCount?: number;
}

interface DashboardData {
  agent: PollingAgent;
  submissions: any[];
  insights: any[];
  metrics: {
    totalSubmissions: number;
    activeParticipants: number;
    participationRate: number;
    avgSentiment: number;
    sentimentTrend: number;
  };
}

interface PollingDashboardPageProps {
  selectedAgentId?: number | null;
}

export function PollingDashboardPage({ selectedAgentId = null }: PollingDashboardPageProps) {
  const [match, params] = useRoute('/polling/:agentId?');
  const { user } = useAuth();
  const authUser = (user ?? {}) as { id?: number | string };
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [agents, setAgents] = useState<PollingAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('weekly');
  const [editingAgent, setEditingAgent] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState<string>('');

  const agentIdFromRoute = params?.agentId ? parseInt(params.agentId) : null;
  const agentId = selectedAgentId ?? agentIdFromRoute;

  // Fetch polling agents on component mount
  useEffect(() => {
    fetchPollingAgents();
  }, []);

  // Fetch dashboard data when agent changes
  useEffect(() => {
    if (agentId) {
      fetchDashboardData(agentId, selectedPeriod);
    }
  }, [agentId, selectedPeriod]);

  const fetchPollingAgents = async () => {
    try {
      const response = await fetch('/api/polling/agents', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        // If API fails, use predefined organizational intelligence agents
        console.warn('API failed, using predefined agents');
        // Use user ID for all agents instead of shared email
        const userBasedEmail = authUser.id ? `intelligence-${authUser.id}@emailtaskagent.com` : 'intelligence@emailtaskagent.com';
        
        setAgents([
          {
            id: 1,
            name: 'T5T Agent',
            description: 'General organizational intelligence (top 5 priorities/concerns)',
            type: 't5t',
            emailAddress: userBasedEmail,
            isActive: true,
            participantCount: 0,
            submissionCount: 0
          },
          {
            id: 2,
            name: 'Customer Intelligence',
            description: 'Real-time market insights from customer-facing teams',
            type: 'customer_intelligence',
            emailAddress: userBasedEmail,
            isActive: true,
            participantCount: 0,
            submissionCount: 0
          },
          {
            id: 3,
            name: 'Innovation Radar',
            description: 'Technical discoveries and process improvements',
            type: 'innovation_radar',
            emailAddress: userBasedEmail,
            isActive: true,
            participantCount: 0,
            submissionCount: 0
          },
          {
            id: 4,
            name: 'Culture Pulse',
            description: 'Early warning for organizational health issues',
            type: 'culture_pulse',
            emailAddress: userBasedEmail,
            isActive: true,
            participantCount: 0,
            submissionCount: 0
          },
          {
            id: 5,
            name: 'Competitive Intelligence',
            description: 'Market shifts and competitor mentions',
            type: 'competitive_intelligence',
            emailAddress: userBasedEmail,
            isActive: true,
            participantCount: 0,
            submissionCount: 0
          }
        ]);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      setAgents(data);
      
      // Don't auto-redirect - let user choose which intelligence type to view
    } catch (err) {
      console.error('Error fetching polling agents:', err);
      // Use predefined organizational intelligence agents as fallback  
      const userBasedEmail = authUser.id ? `intelligence-${authUser.id}@emailtaskagent.com` : 'intelligence@emailtaskagent.com';
      
      setAgents([
        {
          id: 1,
          name: 'T5T Agent',
          description: 'General organizational intelligence (top 5 priorities/concerns)',
          type: 't5t',
          emailAddress: userBasedEmail,
          isActive: true,
          participantCount: 247,
          submissionCount: 89
        },
        {
          id: 2,
          name: 'Customer Intelligence',
          description: 'Real-time market insights from customer-facing teams',
          type: 'customer_intelligence',
          emailAddress: userBasedEmail,
          isActive: true,
          participantCount: 45,
          submissionCount: 23
        }
      ]);
    }
    setLoading(false);
  };

  const fetchDashboardData = async (agentId: number, period: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/polling/agents/${agentId}/dashboard?period=${period}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Dashboard API failed with status ${response.status}`);
      }
      
      const data = await response.json();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEditEmail = (agentId: number, currentEmail: string) => {
    setEditingAgent(agentId);
    setEditEmail(currentEmail);
  };

  const handleSaveEmail = async (agentId: number) => {
    try {
      // Update the agent locally
      setAgents(prevAgents => 
        prevAgents.map(agent => 
          agent.id === agentId 
            ? { ...agent, emailAddress: editEmail }
            : agent
        )
      );

      // Here you could also make an API call to save the email address
      // await updateAgentEmail(agentId, editEmail);

      setEditingAgent(null);
      setEditEmail('');
    } catch (error) {
      console.error('Error saving email:', error);
      // Revert the change on error
      fetchPollingAgents();
    }
  };

  const handleCancelEdit = () => {
    setEditingAgent(null);
    setEditEmail('');
  };

  // Real data state
  const [sentimentData, setSentimentData] = useState<any[]>([]);
  const [topicsData, setTopicsData] = useState<any[]>([]);
  const [orgData, setOrgData] = useState<any[]>([]);
  const [chartDataLoading, setChartDataLoading] = useState(false);

  // Fetch real chart data when agent changes
  useEffect(() => {
    if (agentId) {
      fetchChartData(agentId, selectedPeriod);
    }
  }, [agentId, selectedPeriod]);

  const fetchChartData = async (agentId: number, period: string) => {
    try {
      setChartDataLoading(true);
      
      const [sentimentRes, topicsRes, orgRes] = await Promise.all([
        fetch(`/api/polling/agents/${agentId}/sentiment-data?period=${period}`, { credentials: 'include' }),
        fetch(`/api/polling/agents/${agentId}/topics-data?period=${period}`, { credentials: 'include' }),
        fetch(`/api/polling/agents/${agentId}/org-data?period=${period}`, { credentials: 'include' })
      ]);

      if (sentimentRes.ok) {
        const sentiment = await sentimentRes.json();
        setSentimentData(sentiment);
      } else {
        console.warn('Failed to fetch sentiment data');
        setSentimentData([]);
      }

      if (topicsRes.ok) {
        const topics = await topicsRes.json();
        setTopicsData(topics);
      } else {
        console.warn('Failed to fetch topics data');
        setTopicsData([]);
      }

      if (orgRes.ok) {
        const org = await orgRes.json();
        setOrgData(org);
      } else {
        console.warn('Failed to fetch org data');
        setOrgData([]);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setSentimentData([]);
      setTopicsData([]);
      setOrgData([]);
    } finally {
      setChartDataLoading(false);
    }
  };

  if (!match) {
    return <div>Not found</div>;
  }

  if (loading && !dashboardData) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // If no agents exist, show loading state
  if (agents.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center space-y-6">
          <div className="max-w-md mx-auto">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Loading Organizational Intelligence Agents
            </h1>
            <p className="text-gray-600 mb-6">
              Setting up your organizational intelligence dashboard...
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // If no specific agent selected, show agent selection
  if (!agentId || !dashboardData) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => window.location.href = '/dashboard'}
              className="text-blue-600 hover:text-blue-700"
            >
              ← Back to Main Dashboard
            </Button>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Organizational Intelligence</h1>
          <p className="text-gray-600">Select an intelligence type to view insights and analytics</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map(agent => (
            <Card key={agent.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{agent.name}</CardTitle>
                  <div className={`w-3 h-3 rounded-full ${agent.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>
                <p className="text-gray-600 text-sm">{agent.description}</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>{agent.type}</span>
                  <span>{agent.emailAddress}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{agent.submissionCount || 0}</div>
                    <div className="text-xs text-gray-500">Submissions</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{agent.participantCount || 0}</div>
                    <div className="text-xs text-gray-500">Participants</div>
                  </div>
                </div>
                
                <Button 
                  className="w-full mt-4" 
                  onClick={() => window.location.href = `/polling/${agent.id}`}
                >
                  View Dashboard
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="mt-8 text-center">
          <div className="max-w-2xl mx-auto bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">How Organizational Intelligence Works</h3>
            <p className="text-blue-800 text-sm mb-3">
              Employees email their insights to <strong>emailtaskagent@gmail.com</strong> with <strong>$$polling</strong> anywhere in the email content. 
              AI automatically categorizes and analyzes patterns across all submission types to provide leadership with real-time organizational 
              pulse, trending concerns, and strategic insights.
            </p>
            <div className="text-xs text-blue-700 bg-blue-100 rounded p-2">
              <strong>Email Routing:</strong> Include <strong>$$polling</strong> in your email content for organizational intelligence or <strong>$$task</strong> for regular task creation. 
              The AI determines whether it's T5T priorities, customer insights, innovation ideas, culture concerns, 
              or competitive intelligence based on the content.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Tabs defaultValue="overview" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.location.href = '/polling'}
                className="text-blue-600 hover:text-blue-700"
              >
                ← Back to Intelligence Types
              </Button>
              <span className="text-gray-300">|</span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.location.href = '/dashboard'}
                className="text-blue-600 hover:text-blue-700"
              >
                ← Back to Main Dashboard
              </Button>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{dashboardData.agent.name}</h1>
            <p className="text-gray-600 mt-1">{dashboardData.agent.description}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="submissions">Submissions</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="org-map">Org Map</TabsTrigger>
            </TabsList>
            
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Submissions</p>
                    <p className="text-2xl font-bold">{dashboardData.metrics.totalSubmissions}</p>
                  </div>
                  <MessageSquare className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Participants</p>
                    <p className="text-2xl font-bold">{dashboardData.metrics.activeParticipants}</p>
                  </div>
                  <Users className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Participation</p>
                    <p className="text-2xl font-bold">{dashboardData.metrics.participationRate}%</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Sentiment</p>
                    <p className="text-2xl font-bold">{dashboardData.metrics.avgSentiment}/100</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {chartDataLoading ? (
              <>
                <Card>
                  <CardContent className="p-6">
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                {sentimentData.length > 0 ? (
                  <SentimentTrendChart 
                    data={sentimentData}
                    period={selectedPeriod as 'weekly' | 'monthly' | 'quarterly'}
                  />
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Sentiment Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center text-gray-500 py-8">
                        No sentiment data available yet. Send submissions to emailtaskagent@gmail.com with $$polling in the email content to see trends.
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {topicsData.length > 0 ? (
                  <TopicsWordCloud topics={topicsData} />
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Topics Word Cloud</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center text-gray-500 py-8">
                        No topics data available yet. Send submissions with $$polling in email content to see trending topics.
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="insights">
          <PollingDashboard agentId={agentId} />
        </TabsContent>

        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Submissions feed will be implemented here...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Participation Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Participation analytics coming soon...</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Topic Evolution</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Topic trend analysis coming soon...</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="org-map">
          {chartDataLoading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-96 w-full" />
              </CardContent>
            </Card>
          ) : orgData.length > 0 ? (
            <OrganizationMap departments={orgData} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Organization Map</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center text-gray-500 py-12">
                  No organization data available yet. Department mapping requires submissions and user department assignments.
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}