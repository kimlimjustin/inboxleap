import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  MessageSquare, 
  AlertTriangle, 
  ThumbsUp,
  ThumbsDown,
  Search,
  Filter,
  Calendar,
  BarChart3,
  PieChart,
  Activity
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

interface MetricCard {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
}

interface Insight {
  id: number;
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  isAlert: boolean;
  confidence: number;
  period: string;
  viewCount: number;
  data: any;
}

interface PollingDashboardProps {
  agentId?: number;
  className?: string;
}

export function PollingDashboard({ agentId, className }: PollingDashboardProps) {
  const [selectedAgent, setSelectedAgent] = useState<PollingAgent | null>(null);
  const [agents, setAgents] = useState<PollingAgent[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('weekly');
  const [selectedInsightType, setSelectedInsightType] = useState('all');

  // Fetch real data from API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch polling agents and insights from API
        const [agentsResponse, insightsResponse] = await Promise.all([
          fetch('/api/polling-agents'),
          fetch('/api/polling-insights')
        ]);

        if (agentsResponse.ok) {
          const agentsData = await agentsResponse.json();
          setAgents(agentsData);
          
          if (agentId) {
            setSelectedAgent(agentsData.find((a: PollingAgent) => a.id === agentId) || agentsData[0]);
          } else if (agentsData.length > 0) {
            setSelectedAgent(agentsData[0]);
          }
        }

        if (insightsResponse.ok) {
          const insightsData = await insightsResponse.json();
          setInsights(insightsData);
        }
      } catch (error) {
        console.error('Error fetching polling data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [agentId]);

  const metrics: MetricCard[] = [
    {
      title: 'Total Submissions',
      value: selectedAgent?.submissionCount || 0,
      change: '', // Calculate change from backend data
      trend: 'stable',
      icon: <MessageSquare className="h-4 w-4" />
    },
    {
      title: 'Active Participants',
      value: selectedAgent?.participantCount || 0,
      change: '', // Calculate change from backend data
      trend: 'stable',
      icon: <Users className="h-4 w-4" />
    },
    {
      title: 'Participation Rate',
      value: selectedAgent?.participantCount && selectedAgent?.submissionCount 
        ? `${Math.round((selectedAgent.submissionCount / selectedAgent.participantCount) * 100)}%`
        : '0%',
      change: '', // Calculate change from backend data
      trend: 'stable',
      icon: <Activity className="h-4 w-4" />
    },
    {
      title: 'Avg Sentiment',
      value: 'N/A', // Get from insights data or backend calculation
      change: '',
      trend: 'stable',
      icon: <ThumbsUp className="h-4 w-4" />
    }
  ];

  const filteredInsights = insights.filter(insight => {
    const matchesSearch = insight.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         insight.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedInsightType === 'all' || insight.type === selectedInsightType;
    return matchesSearch && matchesType;
  });

  const alertInsights = insights.filter(i => i.isAlert);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Polling Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            {selectedAgent ? `${selectedAgent.name} - ${selectedAgent.description}` : 'Select a polling agent'}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={selectedAgent?.id.toString()} onValueChange={(value) => {
            const agent = agents.find(a => a.id === parseInt(value));
            setSelectedAgent(agent || null);
          }}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select polling agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map(agent => (
                <SelectItem key={agent.id} value={agent.id.toString()}>
                  {agent.name} ({agent.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Alerts */}
      {alertInsights.length > 0 && (
        <div className="space-y-2">
          {alertInsights.map(insight => (
            <Alert key={insight.id} className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>{insight.title}:</strong> {insight.description}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                  <p className="text-2xl font-bold">{metric.value}</p>
                  {metric.change && (
                    <div className="flex items-center mt-1">
                      {metric.trend === 'up' ? (
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                      ) : metric.trend === 'down' ? (
                        <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                      ) : null}
                      <span className={`text-xs ${
                        metric.trend === 'up' ? 'text-green-600' : 
                        metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {metric.change}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-gray-400">
                  {metric.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="orgmap">Org Map</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          {/* Search and Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search insights..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedInsightType} onValueChange={setSelectedInsightType}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Insights</SelectItem>
                <SelectItem value="trending_topics">Trending Topics</SelectItem>
                <SelectItem value="sentiment_trend">Sentiment Trends</SelectItem>
                <SelectItem value="emerging_signals">Emerging Signals</SelectItem>
                <SelectItem value="team_mood">Team Mood</SelectItem>
                <SelectItem value="pain_points">Pain Points</SelectItem>
                <SelectItem value="ideas_suggestions">Ideas & Suggestions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Insights Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredInsights.map(insight => (
              <Card key={insight.id} className={insight.isAlert ? 'border-red-200' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-lg">{insight.title}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        insight.priority === 'high' ? 'destructive' : 
                        insight.priority === 'medium' ? 'default' : 'secondary'
                      }>
                        {insight.priority}
                      </Badge>
                      {insight.isAlert && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">{insight.description}</p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>Confidence: {insight.confidence}%</span>
                    <span>{insight.period}</span>
                  </div>
                  
                  <Progress value={insight.confidence} className="mt-2" />
                  
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-gray-400">Views: {insight.viewCount}</span>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Submission feed coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Topic Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Topic trend charts coming soon...</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Sentiment Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Sentiment breakdown coming soon...</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orgmap">
          <Card>
            <CardHeader>
              <CardTitle>Organization Map</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Interactive org chart coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}