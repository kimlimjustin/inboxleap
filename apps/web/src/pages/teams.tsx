import EnhancedAgentCard from "@/components/EnhancedAgentCard";
import OverviewDashboard from "@/components/OverviewDashboard";
import { getTeamAgents } from "@/config/agents";
import { CheckSquare, Users, MessageSquare, HelpCircle } from "lucide-react";

export default function Teams() {
  // Use static agent configuration instead of API calls for faster loading
  const configAgents = getTeamAgents();

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

  // All agents from config are available
  const availableAgents = agents;

  return (
    <div className="max-w-7xl mx-auto px-8 py-6">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-3xl">📋</span>
            <h2 className="text-2xl font-bold text-gray-900">Choose Your Team Agent</h2>
          </div>
        <p className="text-gray-600 mb-2">
          Select an agent to start coordinating tasks and managing projects
        </p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
            {availableAgents.length} Agents Available
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6" data-tour="agent-grid">
        {availableAgents.map((agent, index) => {
          // Get proper icon from agent config
          const configAgents = getTeamAgents();
          const agentConfig = configAgents.find(a => a.id === agent.id);
          const IconComponent = agentConfig?.icon || Users;

          return (
            <div key={agent.id} data-tour={index === 0 ? "available-agent" : ""}>
              <EnhancedAgentCard
                name={agent.name}
                type={agent.type}
                description={agent.description}
                email={agent.email}
                color={(agentConfig?.color || 'green') as 'blue' | 'green' | 'purple' | 'orange'}
                status={agent.statusLabel as any}
                stats={agent.stats}
                actionLabel="View Details"
                route={agent.route}
                icon={IconComponent}
              />
            </div>
          );
        })}
      </div>

      <div data-tour="overview-dashboard">
        <OverviewDashboard workspace="teams" />
      </div>
    </div>
  );
}
