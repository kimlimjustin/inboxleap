import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

interface AgentStats {
  momentum?: string;
  dataPoints?: number;
  updated?: string;
  collaboration?: string;
  analyzed?: number;
  opportunities?: number;
  sources?: number;
  mobiletrend?: string;
  eveningPeaks?: boolean;
  reach?: string;
  tasks?: number;
  inProgress?: number;
  completed?: number;
  announcements?: number;
  pending?: number;
  polls?: number;
  responses?: string;
  closing?: string;
  questions?: number;
  totalQAs?: number;
  accuracy?: string;
}

interface EnhancedAgentProps {
  name: string;
  type: string;
  description: string;
  email: string[];
  color: 'blue' | 'green' | 'purple' | 'orange';
  status: 'Latest Report' | 'Pattern Detected' | 'New Opportunity' | 'Weekly Report' | 'Most Active' | 'Processing' | 'Waiting Input' | 'Learning';
  stats?: AgentStats;
  actionLabel: string;
  route?: string;
  isUnavailable?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

export default function EnhancedAgentCard({
  name,
  type,
  description,
  email,
  color,
  status,
  stats,
  actionLabel,
  route,
  isUnavailable = false,
  icon: IconComponent
}: EnhancedAgentProps) {
  const [, setLocation] = useLocation();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Latest Report': return 'bg-blue-100 text-blue-800';
      case 'Pattern Detected': return 'bg-green-100 text-green-800';
      case 'New Opportunity': return 'bg-purple-100 text-purple-800';
      case 'Weekly Report': return 'bg-orange-100 text-orange-800';
      case 'Most Active': return 'bg-blue-100 text-blue-800';
      case 'Processing': return 'bg-green-100 text-green-800';
      case 'Waiting Input': return 'bg-purple-100 text-purple-800';
      case 'Learning': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCardColor = (color: string) => {
    switch (color) {
      case 'blue': return 'border-t-blue-500';
      case 'green': return 'border-t-green-500';
      case 'purple': return 'border-t-purple-500';
      case 'orange': return 'border-t-orange-500';
      default: return 'border-t-gray-500';
    }
  };

  const getButtonColor = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-600 hover:bg-blue-700 text-white';
      case 'green': return 'bg-green-600 hover:bg-green-700 text-white';
      case 'purple': return 'bg-purple-600 hover:bg-purple-700 text-white';
      case 'orange': return 'bg-orange-600 hover:bg-orange-700 text-white';
      default: return 'bg-gray-600 hover:bg-gray-700 text-white';
    }
  };

  const renderStats = () => {
    if (!stats) return null;

    return (
      <div className="space-y-3 mb-4">
        {stats.momentum && (
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">{stats.momentum} momentum</span>
            {stats.dataPoints && (
              <span className="text-sm text-gray-600">• {stats.dataPoints} data points</span>
            )}
          </div>
        )}

        {stats.collaboration && (
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">{stats.collaboration} collaboration</span>
            {stats.analyzed && (
              <span className="text-sm text-gray-600">• {stats.analyzed} analyzed</span>
            )}
          </div>
        )}

        {stats.opportunities !== undefined && (
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">{stats.opportunities} opportunities</span>
            {stats.sources && (
              <span className="text-sm text-gray-600">• {stats.sources} sources</span>
            )}
          </div>
        )}

        {stats.mobiletrend && (
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">{stats.mobiletrend} mobile trend</span>
            {stats.eveningPeaks && (
              <span className="text-sm text-gray-600">• Evening peaks</span>
            )}
          </div>
        )}

        {stats.tasks !== undefined && (
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">{stats.tasks} active tasks</span>
            {stats.inProgress !== undefined && (
              <span className="text-sm text-gray-600">• {stats.inProgress} in progress</span>
            )}
          </div>
        )}

        {stats.completed !== undefined && (
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-600">{stats.completed} completed today</span>
          </div>
        )}

        {stats.announcements !== undefined && (
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">{stats.announcements} announcements</span>
            {stats.pending !== undefined && (
              <span className="text-sm text-gray-600">• {stats.pending} pending</span>
            )}
          </div>
        )}

        {stats.reach && (
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">{stats.reach} reach</span>
          </div>
        )}

        {stats.polls !== undefined && (
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">{stats.polls} active polls</span>
            {stats.responses && (
              <span className="text-sm text-gray-600">• {stats.responses} responses</span>
            )}
          </div>
        )}

        {stats.closing && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-gray-600">{stats.closing} closing soon</span>
          </div>
        )}

        {stats.questions !== undefined && (
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">{stats.questions} new questions</span>
            {stats.totalQAs && (
              <span className="text-sm text-gray-600">• {stats.totalQAs} total Q&As</span>
            )}
          </div>
        )}

        {stats.accuracy && (
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-600">{stats.accuracy} accuracy</span>
          </div>
        )}

        {stats.updated && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Updated {stats.updated}</span>
          </div>
        )}
      </div>
    );
  };

  if (isUnavailable) {
    return (
      <Card className="h-full border-t-4 border-gray-300 opacity-60 bg-gray-50">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100">
                <IconComponent className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-500">{name}</h3>
                <p className="text-sm text-gray-400">{type}</p>
              </div>
            </div>
            <Badge className="text-xs bg-gray-100 text-gray-500 border-gray-200">
              Coming Soon
            </Badge>
          </div>

          <div className="text-sm text-gray-400 mb-3">
            {description}
          </div>

          {/* Email addresses - grayed out */}
          <div className="space-y-1">
            {email.map((addr, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                <code className="text-xs text-gray-400">{addr}</code>
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-4 text-center py-4">
            <p className="text-sm text-gray-400">This agent is currently being developed</p>
          </div>

          <Button
            disabled
            className="w-full bg-gray-300 text-gray-500 cursor-not-allowed"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Coming Soon
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`h-full hover:shadow-lg transition-all duration-200 border-t-4 ${getCardColor(color)}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${color}-50`}>
              <IconComponent className={`w-6 h-6 text-${color}-600`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
              <p className="text-sm text-gray-600">{type}</p>
            </div>
          </div>
          <Badge className={`text-xs ${getStatusColor(status)}`}>
            {status}
          </Badge>
        </div>

        <div className="text-sm text-gray-600 mb-3">
          {description}
        </div>

        {/* Email addresses */}
        <div className="space-y-1">
          {email.map((addr, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
              <code className="text-xs text-gray-500">{addr}</code>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {renderStats()}

        <Button
          className={`w-full ${getButtonColor(color)}`}
          onClick={() => route && setLocation(route)}
        >
          <ArrowRight className="w-4 h-4 mr-2" />
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}