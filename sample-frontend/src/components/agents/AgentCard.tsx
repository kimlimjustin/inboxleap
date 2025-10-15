import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Activity, 
  MoreVertical, 
  Play, 
  Pause, 
  Settings, 
  Mail, 
  TrendingUp,
  Users,
  FileText
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Agent {
  id: string;
  name: string;
  email: string;
  icon: React.ElementType;
  color: string;
  lightColor: string;
  description: string;
  features: string[];
  status: 'active' | 'paused' | 'inactive';
  lastActivity: string;
  stats: Record<string, number>;
}

interface AgentCardProps {
  agent: Agent;
}

const AgentCard = ({ agent }: AgentCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const IconComponent = agent.icon;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'inactive':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleEmailAgent = () => {
    window.open(`mailto:${agent.email}?subject=Hello ${agent.name}&body=Hi ${agent.name},%0D%0A%0D%0A`, '_blank');
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="hover-glow border-0 shadow-soft overflow-hidden">
        <CardHeader className="relative pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${agent.color}`}>
                <IconComponent className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {agent.name}
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
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
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Configure
                </DropdownMenuItem>
                <DropdownMenuItem>
                  {agent.status === 'active' ? (
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

          <div className={`absolute top-4 right-14 px-2 py-1 rounded-md text-xs font-medium ${agent.lightColor}`}>
            {agent.status}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Features */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Key Features</h4>
            <div className="flex flex-wrap gap-1">
              {agent.features.slice(0, isExpanded ? agent.features.length : 3).map((feature) => (
                <Badge key={feature} variant="secondary" className="text-xs">
                  {feature}
                </Badge>
              ))}
              {agent.features.length > 3 && !isExpanded && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setIsExpanded(true)}
                >
                  +{agent.features.length - 3} more
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(agent.stats).map(([key, value]) => (
              <div key={key} className="text-center">
                <div className="text-lg font-bold">{value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {key}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="flex-1 bg-gradient-primary hover:shadow-glow"
              onClick={handleEmailAgent}
            >
              <Mail className="mr-2 h-4 w-4" />
              Email Agent
            </Button>
            <Button variant="outline" size="sm" className="hover-lift">
              <Activity className="h-4 w-4" />
            </Button>
          </div>

          {/* Contact Info */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <code className="bg-muted px-2 py-1 rounded text-xs">
                {agent.email}
              </code>
              <span>Active {agent.lastActivity}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AgentCard;