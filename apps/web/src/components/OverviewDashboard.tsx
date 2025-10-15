import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Mail, Lightbulb, MessageSquare, Clock, CheckSquare } from "lucide-react";

interface OverviewProps {
  workspace: 'intelligence' | 'teams';
  data?: {
    emailsAnalyzed?: number;
    keyInsights?: number;
    opportunities?: number;
    avgResponseTime?: string;
    tasksProcessed?: number;
    communications?: number;
    decisionsMade?: number;
    questionsAnswered?: number;
  };
}

export default function OverviewDashboard({ workspace, data }: OverviewProps) {
  const intelligenceData = {
    title: "Intelligence Overview",
    actionLabel: "Live Analytics",
    metrics: [
      { label: "Emails Analyzed", value: data?.emailsAnalyzed?.toString() || "0", icon: Mail },
      { label: "Key Insights", value: data?.keyInsights?.toString() || "0", icon: Lightbulb },
      { label: "Opportunities", value: data?.opportunities?.toString() || "0", icon: BarChart3 },
      { label: "Avg Response Time", value: data?.avgResponseTime || "N/A", icon: Clock }
    ]
  };

  const teamsData = {
    title: "Teams Overview",
    actionLabel: "Today's Activity",
    metrics: [
      { label: "Tasks Processed", value: data?.tasksProcessed?.toString() || "0", icon: CheckSquare },
      { label: "Communications", value: data?.communications?.toString() || "0", icon: MessageSquare },
      { label: "Decisions Made", value: data?.decisionsMade?.toString() || "0", icon: Lightbulb },
      { label: "Questions Answered", value: data?.questionsAnswered?.toString() || "0", icon: Mail }
    ]
  };

  const displayData = workspace === 'intelligence' ? intelligenceData : teamsData;
  const bgColor = workspace === 'intelligence' ? 'bg-blue-900' : 'bg-green-700';

  return (
    <Card className={`${bgColor} text-white`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            <CardTitle className="text-xl font-semibold">{displayData.title}</CardTitle>
          </div>
          <Button variant="secondary" size="sm" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
            {displayData.actionLabel}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-8">
          {displayData.metrics.map((metric, index) => {
            const IconComponent = metric.icon;
            return (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold mb-1">{metric.value}</div>
                <div className="text-sm text-white/80 mb-2">{metric.label}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}