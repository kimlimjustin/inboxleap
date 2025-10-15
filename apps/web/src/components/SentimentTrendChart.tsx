import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SentimentDataPoint {
  period: string;
  score: number;
  submissions: number;
  departments?: Array<{
    name: string;
    score: number;
    change: number;
  }>;
}

interface SentimentTrendChartProps {
  data: SentimentDataPoint[];
  period: 'weekly' | 'monthly' | 'quarterly';
  className?: string;
}

export function SentimentTrendChart({ data, period, className }: SentimentTrendChartProps) {
  const latestData = data[data.length - 1];
  const previousData = data[data.length - 2];
  
  const overallTrend = latestData && previousData 
    ? latestData.score - previousData.score 
    : 0;

  const getSentimentColor = (score: number) => {
    if (score >= 60) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 30) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getSentimentLabel = (score: number) => {
    if (score >= 60) return 'Positive';
    if (score >= 30) return 'Neutral';
    return 'Negative';
  };

  const getTrendIcon = (change: number) => {
    if (change > 5) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (change < -5) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-gray-500" />;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Sentiment Trends</span>
          <div className="flex items-center gap-2">
            {getTrendIcon(overallTrend)}
            <span className={`text-sm ${overallTrend > 0 ? 'text-green-600' : overallTrend < 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {overallTrend > 0 ? '+' : ''}{overallTrend.toFixed(1)}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Overall Sentiment */}
        {latestData && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Sentiment</span>
              <Badge className={getSentimentColor(latestData.score)}>
                {getSentimentLabel(latestData.score)}
              </Badge>
            </div>
            
            {/* Sentiment Score Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  latestData.score >= 60 ? 'bg-green-500' : 
                  latestData.score >= 30 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.max(latestData.score, 5)}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-gray-500">
              <span>Negative</span>
              <span className="font-medium">{latestData.score}/100</span>
              <span>Positive</span>
            </div>
          </div>
        )}

        {/* Simple Trend Visualization */}
        <div className="space-y-2 mb-6">
          <h4 className="text-sm font-medium text-gray-700">Recent Trend</h4>
          <div className="flex items-end gap-1 h-16">
            {data.slice(-8).map((point, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className={`w-full rounded-t transition-all duration-300 ${
                    point.score >= 60 ? 'bg-green-400' : 
                    point.score >= 30 ? 'bg-orange-400' : 'bg-red-400'
                  }`}
                  style={{ height: `${Math.max(point.score, 5)}%` }}
                />
                <span className="text-xs text-gray-500 mt-1 rotate-45 origin-left">
                  {point.period.split('-').pop()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Department Breakdown */}
        {latestData?.departments && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">By Department</h4>
            <div className="space-y-2">
              {latestData.departments.map((dept, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium">{dept.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{dept.score}/100</span>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(dept.change)}
                      <span className={`text-xs ${
                        dept.change > 0 ? 'text-green-600' : 
                        dept.change < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {dept.change > 0 ? '+' : ''}{dept.change}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submissions Count */}
        {latestData && (
          <div className="mt-4 pt-4 border-t text-xs text-gray-500">
            Based on {latestData.submissions} submissions this {period.slice(0, -2)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}