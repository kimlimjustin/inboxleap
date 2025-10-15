import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TopicData {
  name: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number; // percentage change
  category?: 'positive' | 'neutral' | 'negative';
}

interface TopicsWordCloudProps {
  topics: TopicData[];
  maxItems?: number;
  className?: string;
}

export function TopicsWordCloud({ topics, maxItems = 20, className }: TopicsWordCloudProps) {
  const sortedTopics = topics
    .sort((a, b) => b.count - a.count)
    .slice(0, maxItems);

  const maxCount = Math.max(...sortedTopics.map(t => t.count));
  
  const getFontSize = (count: number) => {
    const ratio = count / maxCount;
    return Math.max(12, Math.min(32, 12 + ratio * 20));
  };

  const getTopicColor = (topic: TopicData) => {
    if (topic.category === 'positive') return 'text-green-600 hover:text-green-700';
    if (topic.category === 'negative') return 'text-red-600 hover:text-red-700';
    return 'text-blue-600 hover:text-blue-700';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-3 w-3 text-green-500" />;
      case 'down': return <TrendingDown className="h-3 w-3 text-red-500" />;
      default: return <Minus className="h-3 w-3 text-gray-400" />;
    }
  };

  const topTrendingTopics = sortedTopics
    .filter(t => t.trend === 'up')
    .sort((a, b) => b.trendValue - a.trendValue)
    .slice(0, 5);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Trending Topics</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Word Cloud Visualization */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg min-h-[200px] flex flex-wrap items-center justify-center gap-2 content-center">
          {sortedTopics.map((topic, index) => (
            <button
              key={index}
              className={`font-medium transition-all duration-200 hover:scale-110 cursor-pointer ${getTopicColor(topic)}`}
              style={{ fontSize: `${getFontSize(topic.count)}px` }}
              title={`${topic.name}: ${topic.count} mentions (${topic.trendValue > 0 ? '+' : ''}${topic.trendValue}%)`}
            >
              {topic.name}
            </button>
          ))}
        </div>

        {/* Top Trending List */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Top Trending</h4>
          <div className="space-y-2">
            {topTrendingTopics.map((topic, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-white border rounded">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{topic.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {topic.count} mentions
                  </Badge>
                </div>
                
                <div className="flex items-center gap-1">
                  {getTrendIcon(topic.trend)}
                  <span className={`text-sm font-medium ${
                    topic.trend === 'up' ? 'text-green-600' : 
                    topic.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {topic.trendValue > 0 ? '+' : ''}{topic.trendValue}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Topic Categories */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Positive Topics</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Neutral Topics</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Concerning Topics</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}