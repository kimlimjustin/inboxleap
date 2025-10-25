import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  MessageCircle, 
  FileText, 
  Paperclip, 
  HelpCircle, 
  Vote,
  Users,
  Brain,
  CheckSquare,
  Plus,
  Settings,
  TrendingUp,
  Activity
} from 'lucide-react';
import Header from '@/components/layout/Header';
import AgentCard from '@/components/agents/AgentCard';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import { useAuth } from '@/contexts/AuthContext';

const intelligenceAgents = [
  {
    id: 'tanya',
    name: 'Tanya',
    email: 'tanya@inboxleap.com',
    icon: BarChart3,
    color: 'agent-tanya',
    lightColor: 'agent-tanya-light',
    description: 'Analyzes trending topics and provides top five insights from your emails',
    features: ['Trend Analysis', 'Email Insights', 'Topic Tracking', 'Weekly Reports'],
    status: 'active' as const,
    lastActivity: '2 minutes ago',
    stats: { processed: 1247, insights: 89 }
  },
  {
    id: 'sally',
    name: 'Sally',
    email: 'sally@inboxleap.com',
    icon: MessageCircle,
    color: 'agent-sally',
    lightColor: 'agent-sally-light',
    description: 'Conducts surveys and analyzes sentiment across your email communications',
    features: ['Sentiment Analysis', 'Survey Creation', 'Feedback Collection', 'Mood Tracking'],
    status: 'active' as const,
    lastActivity: '5 minutes ago',
    stats: { processed: 892, surveys: 23 }
  }
];

const teamAgents = [
  {
    id: 'todo',
    name: 'Todo',
    email: 'todo@inboxleap.com',
    icon: FileText,
    color: 'agent-todo',
    lightColor: 'agent-todo-light',
    description: 'Extracts and manages tasks from your emails with intelligent prioritization',
    features: ['Todo Extraction', 'Task Tracking', 'Project Coordination', 'Deadline Management'],
    status: 'active' as const,
    lastActivity: '1 minute ago',
    stats: { processed: 1456, tasks: 134 }
  },
  {
    id: 'analyzer',
    name: 'Analyzer',
    email: 'analyzer@inboxleap.com',
    icon: Paperclip,
    color: 'agent-analyzer',
    lightColor: 'agent-analyzer-light',
    description: 'Analyzes and categorizes email attachments with smart content extraction',
    features: ['File Analysis', 'Content Extraction', 'Document Processing', 'Auto-Categorization'],
    status: 'active' as const,
    lastActivity: '3 minutes ago',
    stats: { processed: 734, files: 567 }
  },
  {
    id: 'faq',
    name: 'FAQ',
    email: 'faq@inboxleap.com',
    icon: HelpCircle,
    color: 'agent-faq',
    lightColor: 'agent-faq-light',
    description: 'Manages your knowledge base and provides instant answers to common questions',
    features: ['SOP Management', 'Q&A Automation', 'Knowledge Sharing', 'Auto-Responses'],
    status: 'active' as const,
    lastActivity: '7 minutes ago',
    stats: { processed: 456, answers: 89 }
  },
  {
    id: 'polly',
    name: 'Polly',
    email: 'polly@inboxleap.com',
    icon: Vote,
    color: 'agent-polly',
    lightColor: 'agent-polly-light',
    description: 'Creates and manages polls for quick team decision making via email',
    features: ['Quick Polls', 'Team Voting', 'Decision Making', 'Results Analysis'],
    status: 'active' as const,
    lastActivity: '12 minutes ago',
    stats: { processed: 234, polls: 45 }
  }
];

const Dashboard = () => {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('intelligence');

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation('/auth/email');
    }
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Welcome back, {user?.name}! 👋
              </h1>
              <p className="text-muted-foreground">
                Your AI agents have been busy. Here's what's happening.
              </p>
            </div>
            <Button className="bg-gradient-primary hover:shadow-glow">
              <Plus className="mr-2 h-4 w-4" />
              New Agent
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="hover-lift">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Total Emails Processed</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">4,263</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600">+12%</span> from last week
                </p>
              </CardContent>
            </Card>
            <Card className="hover-lift">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">6</div>
                <p className="text-xs text-muted-foreground">
                  All systems operational
                </p>
              </CardContent>
            </Card>
            <Card className="hover-lift">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Tasks Created</CardTitle>
                  <CheckSquare className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">134</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600">+8%</span> completion rate
                </p>
              </CardContent>
            </Card>
            <Card className="hover-lift">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Insights Generated</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">89</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600">+15%</span> this month
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-6">
            <TabsTrigger value="intelligence" className="gap-2">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">Intelligence</span>
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Teams</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="tanya" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Tanya</span>
            </TabsTrigger>
            <TabsTrigger value="analyzer" className="gap-2">
              <Paperclip className="h-4 w-4" />
              <span className="hidden sm:inline">Analyzer</span>
            </TabsTrigger>
            <TabsTrigger value="more" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">More</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="intelligence" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">Intelligence Agents</h2>
              <p className="text-muted-foreground mb-6">
                Company-wide analytics and insights from your email communications.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                {intelligenceAgents.map((agent, index) => (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <AgentCard agent={agent} />
                  </motion.div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="teams" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">Team Agents</h2>
              <p className="text-muted-foreground mb-6">
                Project collaboration and task management agents for your team.
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teamAgents.map((agent, index) => (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <AgentCard agent={agent} />
                  </motion.div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">Task Board</h2>
              <p className="text-muted-foreground mb-6">
                Manage tasks extracted from emails and track your team's progress.
              </p>
              <KanbanBoard />
            </div>
          </TabsContent>

          <TabsContent value="tanya" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                <div className="w-8 h-8 agent-tanya rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-4 w-4" />
                </div>
                Tanya Dashboard
              </h2>
              <p className="text-muted-foreground mb-6">
                Top five insights and trending topics from your email analysis.
              </p>
              <Card>
                <CardHeader>
                  <CardTitle>Agent-Specific Dashboard Coming Soon</CardTitle>
                  <CardDescription>
                    Individual agent dashboards with detailed analytics and controls.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Tanya's analytics dashboard will appear here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analyzer" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                <div className="w-8 h-8 agent-analyzer rounded-lg flex items-center justify-center">
                  <Paperclip className="h-4 w-4" />
                </div>
                Analyzer Dashboard
              </h2>
              <p className="text-muted-foreground mb-6">
                Attachment analysis and file management insights.
              </p>
              <Card>
                <CardHeader>
                  <CardTitle>Agent-Specific Dashboard Coming Soon</CardTitle>
                  <CardDescription>
                    Individual agent dashboards with detailed analytics and controls.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <Paperclip className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Analyzer's file analysis dashboard will appear here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="more" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">More Agents</h2>
              <p className="text-muted-foreground mb-6">
                Additional agent tabs and settings will appear here as you add more agents.
              </p>
              <Card>
                <CardHeader>
                  <CardTitle>Coming Soon</CardTitle>
                  <CardDescription>
                    Additional agent tabs, settings, and customization options.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <Settings className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      More agent management features coming soon.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
