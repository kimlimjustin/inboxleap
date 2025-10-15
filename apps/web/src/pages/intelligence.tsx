import EnhancedAgentCard from "@/components/EnhancedAgentCard";
import OverviewDashboard from "@/components/OverviewDashboard";
import { getIntelligenceAgents } from "@/config/agents";
import { BarChart3, TrendingUp, PieChart, Zap } from "lucide-react";

export default function IntelligenceAgents() {
  // Use static agent configuration instead of API calls for faster loading
  const configAgents = getIntelligenceAgents();

  // Transform config agents to match expected format
  const agents = configAgents.map(agent => ({
    id: agent.id,
    name: agent.name,
    type: agent.type,
    description: agent.description,
    email: [agent.email],
    status: 'active' as const,
    statusLabel: 'Active',
    stats: undefined, // No fake stats, hide if no real data
    route: agent.route
  }));

  // Add unavailable agents to show "coming soon"
  const allAgents = [
    ...agents,
    {
      id: "insight",
      name: "Insight Agent",
      type: "Market intelligence & opportunities",
      description: "Discovers market opportunities and competitive intelligence insights.",
      email: ["insight-market@company.com"],
      status: 'unavailable' as const,
      statusLabel: 'Coming Soon',
      stats: {},
      route: "/todo"
    },
    {
      id: "analyze",
      name: "Analyze Agent",
      type: "Trend detection & behavioral patterns",
      description: "Identifies trends and behavioral patterns across all communication channels.",
      email: ["analyze-trends@company.com"],
      status: 'unavailable' as const,
      statusLabel: 'Coming Soon',
      stats: {},
      route: "/dashboard"
    }
  ];

  const availableAgents = allAgents.filter(agent => agent.status !== 'unavailable');
  const unavailableAgents = allAgents.filter(agent => agent.status === 'unavailable');

  return (
    <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-3xl">🧠</span>
            <h2 className="text-2xl font-bold text-gray-900">Choose Your Intelligence Agent</h2>
          </div>
        <p className="text-gray-600 mb-2">
          Select an agent to dive into strategic insights and analytics
        </p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
            {availableAgents.length} Agents Available
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6  mb-6" data-tour="agent-grid">
        {availableAgents.map((agent, index) => {
          // Get proper icon from agent config
          const configAgents = getIntelligenceAgents();
          const agentConfig = configAgents.find(a => a.id === agent.id);
          const IconComponent = agentConfig?.icon || BarChart3;

          return (
            <div key={agent.id} data-tour={index === 0 ? "available-agent" : ""}>
              <EnhancedAgentCard
                name={agent.name}
                type={agent.type}
                description={agent.description}
                email={agent.email}
                color={(agentConfig?.color || 'blue') as 'blue' | 'green' | 'purple' | 'orange'}
                status={agent.statusLabel as any}
                stats={agent.stats}
                actionLabel="View Details"
                route={agent.route}
                icon={IconComponent}
              />
            </div>
          );
        })}
        {unavailableAgents.map((agent, index) => (
          <div key={agent.id} data-tour={index === 0 ? "unavailable-agent" : ""}>
            <EnhancedAgentCard
              name={agent.name}
              type={agent.type}
              description={agent.type}
              email={agent.email}
              color={agent.id === 'insight' ? 'purple' : 'orange'}
              status={agent.statusLabel as any}
              stats={agent.stats}
              actionLabel="Coming Soon"
              route={agent.route}
              isUnavailable={true}
              icon={agent.id === 'insight' ? PieChart : Zap}
            />
          </div>
        ))}
      </div>

      <div className="" data-tour="overview-dashboard">
        <OverviewDashboard workspace="intelligence" />
      </div>
    </div>
  );
}
