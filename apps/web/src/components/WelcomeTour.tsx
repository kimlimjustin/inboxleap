import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Users, Play, X, ArrowRight } from 'lucide-react';
import { useFirstTimeUser } from '@/hooks/useFirstTimeUser';

interface WelcomeTourProps {
  onStartTour: (workspace: 'intelligence' | 'teams') => void;
  onSkip: () => void;
}

export default function WelcomeTour({ onStartTour, onSkip }: WelcomeTourProps) {
  const { isFirstTime } = useFirstTimeUser();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isFirstTime) {
      const timer = setTimeout(() => {
        setShow(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isFirstTime]);

  if (!show || !isFirstTime) return null;

  const handleStartTour = (workspace: 'intelligence' | 'teams') => {
    setShow(false);
    onStartTour(workspace);
  };

  const handleSkip = () => {
    setShow(false);
    onSkip();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full bg-white shadow-2xl">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-between items-start mb-4">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Welcome! 👋
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to Your AI-Powered Workspace!
          </CardTitle>

          <p className="text-gray-600 text-lg">
            Let's take a quick tour to show you how to get the most out of our Intelligence and Teams workspaces.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-6">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Complete App Tour</h3>
              <p className="text-gray-600">
                We'll guide you through both workspaces to show you all the powerful features available
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Intelligence Preview */}
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Intelligence</h4>
                    <p className="text-xs text-gray-600">Strategic insights</p>
                  </div>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• AI-powered analytics</li>
                  <li>• Market opportunities</li>
                  <li>• Data visualization</li>
                </ul>
              </div>

              {/* Teams Preview */}
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Teams</h4>
                    <p className="text-xs text-gray-600">Collaboration tools</p>
                  </div>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Task management</li>
                  <li>• Team coordination</li>
                  <li>• Project workflows</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-4 border-t">
            <Button
              onClick={() => handleStartTour('intelligence')}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              size="lg"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Complete Tour (Both Workspaces)
            </Button>

            <div className="flex justify-between items-center">
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-gray-500 hover:text-gray-700 text-sm"
                size="sm"
              >
                Skip tour, I'll explore on my own
              </Button>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Takes about 4 minutes</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}