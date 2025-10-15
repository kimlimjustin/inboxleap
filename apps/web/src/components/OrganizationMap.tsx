import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Users, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ChevronDown
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  submissionCount: number;
  lastSubmission?: Date | string;
  sentimentScore: number;
}

interface Team {
  name: string;
  members: TeamMember[];
  submissions: number;
  participationRate: number;
  avgSentiment: number;
  sentimentTrend: number;
  recentTopics: string[];
  isExpanded?: boolean;
}

interface Department {
  name: string;
  teams: Team[];
  submissions: number;
  participationRate: number;
  avgSentiment: number;
  sentimentTrend: number;
  memberCount: number;
  isExpanded?: boolean;
}

interface OrganizationMapProps {
  departments: Department[];
  className?: string;
}

export function OrganizationMap({ departments, className }: OrganizationMapProps) {
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'low_participation' | 'negative_sentiment'>('all');

  const toggleDepartment = (deptName: string) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(deptName)) {
      newExpanded.delete(deptName);
    } else {
      newExpanded.add(deptName);
    }
    setExpandedDepartments(newExpanded);
  };

  const toggleTeam = (teamKey: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamKey)) {
      newExpanded.delete(teamKey);
    } else {
      newExpanded.add(teamKey);
    }
    setExpandedTeams(newExpanded);
  };

  const getSentimentColor = (score: number) => {
    if (score >= 60) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 30) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getParticipationColor = (rate: number) => {
    if (rate >= 70) return 'text-green-600';
    if (rate >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const filteredDepartments = departments.filter(dept => {
    switch (selectedFilter) {
      case 'active':
        return dept.participationRate >= 70;
      case 'low_participation':
        return dept.participationRate < 40;
      case 'negative_sentiment':
        return dept.avgSentiment < 30;
      default:
        return true;
    }
  });

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Organization Map</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={selectedFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedFilter('all')}
            >
              All
            </Button>
            <Button
              variant={selectedFilter === 'active' ? 'default' : 'outline'}       
              size="sm"
              onClick={() => setSelectedFilter('active')}
            >
              High Participation
            </Button>
            <Button
              variant={selectedFilter === 'low_participation' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedFilter('low_participation')}
            >
              Low Participation
            </Button>
            <Button
              variant={selectedFilter === 'negative_sentiment' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedFilter('negative_sentiment')}
            >
              Negative Sentiment
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredDepartments.map((department) => (
            <div key={department.name} className="border rounded-lg">
              {/* Department Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleDepartment(department.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedDepartments.has(department.name) ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    <div>
                      <h3 className="font-semibold text-lg">{department.name}</h3>
                      <p className="text-sm text-gray-600">
                        {department.memberCount} members • {department.teams.length} teams
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Participation Rate */}
                    <div className="text-center">
                      <div className={`text-lg font-bold ${getParticipationColor(department.participationRate)}`}>
                        {department.participationRate}%
                      </div>
                      <div className="text-xs text-gray-500">Participation</div>
                    </div>
                    
                    {/* Sentiment Score */}
                    <div className="text-center">
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-bold">{department.avgSentiment}</span>
                        {department.sentimentTrend > 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : department.sentimentTrend < 0 ? (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        ) : null}
                      </div>
                      <div className="text-xs text-gray-500">Sentiment</div>
                    </div>
                    
                    {/* Submissions */}
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">
                        {department.submissions}
                      </div>
                      <div className="text-xs text-gray-500">Submissions</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Department Teams */}
              {expandedDepartments.has(department.name) && (
                <div className="border-t bg-gray-50">
                  {department.teams.map((team) => {
                    const teamKey = `${department.name}-${team.name}`;
                    return (
                      <div key={teamKey} className="border-b last:border-b-0">
                        {/* Team Header */}
                        <div
                          className="p-3 cursor-pointer hover:bg-gray-100 transition-colors ml-6"
                          onClick={() => toggleTeam(teamKey)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {expandedTeams.has(teamKey) ? (
                                <ChevronDown className="h-3 w-3 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-gray-500" />
                              )}
                              <div>
                                <h4 className="font-medium">{team.name}</h4>
                                <p className="text-xs text-gray-600">
                                  {team.members.length} members
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 text-sm">
                              <span className={getParticipationColor(team.participationRate)}>
                                {team.participationRate}%
                              </span>
                              <Badge className={getSentimentColor(team.avgSentiment)}>
                                {team.avgSentiment}
                              </Badge>
                              <span className="text-gray-600">{team.submissions} submissions</span>
                            </div>
                          </div>
                          
                          {/* Team Topics */}
                          {team.recentTopics.length > 0 && (
                            <div className="flex items-center gap-2 mt-2 ml-5">
                              <span className="text-xs text-gray-500">Recent topics:</span>
                              {team.recentTopics.slice(0, 3).map((topic, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Team Members */}
                        {expandedTeams.has(teamKey) && (
                          <div className="bg-white ml-12 mr-4 mb-3 rounded border">
                            <div className="p-3">
                              <h5 className="text-sm font-medium text-gray-700 mb-2">Team Members</h5>
                              <div className="space-y-2">
                                {team.members.map((member) => (
                                  <div key={member.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                    <div>
                                      <span className="font-medium">{member.name}</span>
                                      <span className="text-gray-500 ml-2">{member.email}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3 text-gray-400" />
                                        <span>{member.submissionCount}</span>
                                      </div>
                                      
                                      <Badge className={getSentimentColor(member.sentimentScore)}>
                                        {member.sentimentScore}
                                      </Badge>
                                      
                                      {member.lastSubmission && (
                                        <span className="text-xs text-gray-500">
                                          {typeof member.lastSubmission === 'string' 
                                            ? new Date(member.lastSubmission).toLocaleDateString()
                                            : member.lastSubmission.toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Legend</h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <strong>Participation Rate:</strong>
              <div className="mt-1">
                <span className="text-green-600">●</span> High (70%+)
                <span className="text-orange-600 ml-3">●</span> Medium (40-69%)
                <span className="text-red-600 ml-3">●</span> Low (&lt;40%)
              </div>
            </div>
            <div>
              <strong>Sentiment Score:</strong>
              <div className="mt-1">
                <span className="text-green-600">●</span> Positive (60+)
                <span className="text-orange-600 ml-3">●</span> Neutral (30-59)
                <span className="text-red-600 ml-3">●</span> Negative (&lt;30)
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}