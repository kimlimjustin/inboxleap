import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  ArrowRight, 
  Eye, 
  EyeOff, 
  MoreVertical, 
  Play, 
  Pause, 
  Settings, 
  Mail, 
  Activity,
  CheckCircle
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAgentUsage } from "@/hooks/useAgentUsage";
import type { Agent } from "@/config/agents";

interface AgentCardProps {
  agent: Agent;
  showExample?: boolean;
  onUse?: (agent: Agent) => void;
}

// Helper function to get agent color class (fallback for agent config compatibility)
const getAgentColorClass = (agent: Agent) => {
  const colorMap: { [key: string]: string } = {
    'tanya': 'agent-tanya',
    'sally': 'agent-sally', 
    'todo': 'agent-todo',
    'analyzer': 'agent-alex',
    'faq': 'agent-faq',
    'polly': 'agent-polly',
  };
  return colorMap[agent.id] || 'agent-tanya';
};

const getAgentLightColorClass = (agent: Agent) => {
  const colorMap: { [key: string]: string } = {
    'tanya': 'agent-tanya-light',
    'sally': 'agent-sally-light',
    'todo': 'agent-todo-light', 
    'analyzer': 'agent-alex-light',
    'faq': 'agent-faq-light',
    'polly': 'agent-polly-light',
  };
  return colorMap[agent.id] || 'agent-tanya-light';
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'bg-green-500';
    case 'paused':
      return 'bg-orange-500';
    case 'inactive':
      return 'bg-gray-500';
    default:
      return 'bg-green-500';
  }
};

export default function AgentCard({ agent, showExample = true, onUse }: AgentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [, setLocation] = useLocation();
  const { trackAgentUsage, isAgentUsed } = useAgentUsage();

  const handleUseAgent = () => {
    trackAgentUsage(agent.id);
    if (onUse) {
      onUse(agent);
    } else if (agent.route) {
      setLocation(agent.route);
    }
  };

  const handleEmailAgent = () => {
    window.open(`mailto:${agent.email}?subject=Hello ${agent.name}&body=Hi ${agent.name},%0D%0A%0D%0A`, '_blank');
  };

  const IconComponent = agent.icon;
  const agentColor = getAgentColorClass(agent);
  const agentLightColor = getAgentLightColorClass(agent);

  return (
    <div className="hover:scale-105 transition-transform duration-200">
      <Card className="border shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden h-full bg-gradient-to-br from-white via-gray-50/30 to-white">
        <CardHeader className="relative pb-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center px-2 ${agentColor} shadow-sm`}>
                <IconComponent className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {agent.name}
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                  {isAgentUsed(agent.id) && (
                    <Badge variant="secondary" className="text-xs">Used</Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-sm">
                  {agent.description}
                </CardDescription>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gradient-to-br from-white via-gray-50/30 to-white border shadow-xl backdrop-blur-sm">
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Configure
                </DropdownMenuItem>
                <DropdownMenuItem>
                  {agent.status === 'Active' ? (
                    <>
                      <Pause className="mr-2 h-4 w-4" />
                      Pause Agent
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Activate Agent
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className={`absolute top-4 right-14 px-2 py-1 rounded-md text-xs font-medium ${agentLightColor}`}>
            {agent.status || 'Active'}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Features */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Key Features</h4>
            <div className="flex flex-wrap gap-1">
              {(agent.features || []).slice(0, isExpanded ? agent.features?.length : 3).map((feature) => (
                <Badge key={feature} variant="secondary" className="text-xs">
                  {feature}
                </Badge>
              ))}
              {(agent.features?.length || 0) > 3 && !isExpanded && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setIsExpanded(true)}
                >
                  +{(agent.features?.length || 0) - 3} more
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Example Section */}
          {showExample && (agent.exampleInput || agent.exampleOutput) && (
            <>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs"
                >
                  {isExpanded ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                  {isExpanded ? 'Hide' : 'Show'} Example
                </Button>

                {isExpanded && (
                  <div className="mt-3 p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg text-xs border border-gray-200">
                    {agent.exampleInput && (
                      <div className="mb-2">
                        <span className="font-medium">Input:</span>
                        <p className="text-muted-foreground mt-1">{agent.exampleInput}</p>
                      </div>
                    )}
                    {agent.exampleOutput && (
                      <div>
                        <span className="font-medium">Output:</span>
                        <p className="text-muted-foreground mt-1">{agent.exampleOutput}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-sm"
              onClick={handleEmailAgent}
            >
              <Mail className="mr-2 h-4 w-4" />
              Email Agent
            </Button>
            <Button variant="outline" size="sm" className="border hover:bg-gray-50 shadow-sm" onClick={handleUseAgent}>
              <Activity className="h-4 w-4" />
            </Button>
          </div>

          {/* Contact Info */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <code className="bg-muted px-2 py-1 rounded text-xs">
                {agent.email}
              </code>
              <span>Type: {agent.type}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
