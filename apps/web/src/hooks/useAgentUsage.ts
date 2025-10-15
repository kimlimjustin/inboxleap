import { useState, useEffect } from 'react';
import { AGENTS, type Agent } from '@/config/agents';

interface AgentUsage {
  agentId: string;
  lastUsed: Date;
  usageCount: number;
}

export function useAgentUsage() {
  const [usedAgents, setUsedAgents] = useState<AgentUsage[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('agent-usage');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUsedAgents(parsed.map((item: any) => ({
          ...item,
          lastUsed: new Date(item.lastUsed)
        })));
      } catch (error) {
        console.error('Failed to parse agent usage data:', error);
      }
    }
  }, []);

  // Save to localStorage whenever usedAgents changes
  useEffect(() => {
    if (usedAgents.length > 0) {
      localStorage.setItem('agent-usage', JSON.stringify(usedAgents));
    }
  }, [usedAgents]);

  const trackAgentUsage = (agentId: string) => {
    setUsedAgents(prev => {
      const existing = prev.find(ua => ua.agentId === agentId);
      if (existing) {
        return prev.map(ua => 
          ua.agentId === agentId 
            ? { ...ua, lastUsed: new Date(), usageCount: ua.usageCount + 1 }
            : ua
        );
      } else {
        return [...prev, {
          agentId,
          lastUsed: new Date(),
          usageCount: 1
        }];
      }
    });
  };

  const getUsedAgents = (): Agent[] => {
    return usedAgents
      .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime()) // Sort by most recently used
      .map(ua => AGENTS.find(agent => agent.id === ua.agentId))
      .filter((agent): agent is Agent => agent !== undefined);
  };

  const isAgentUsed = (agentId: string): boolean => {
    return usedAgents.some(ua => ua.agentId === agentId);
  };

  return {
    trackAgentUsage,
    getUsedAgents,
    isAgentUsed,
    usedAgents
  };
}
