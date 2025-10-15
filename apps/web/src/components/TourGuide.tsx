import { useEffect, useState } from 'react';
import introJs from 'intro.js';
import 'intro.js/introjs.css';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import type { TooltipPosition } from 'intro.js/src/packages/tooltip';

interface TourGuideProps {
  workspace: 'intelligence' | 'teams';
  onClose?: () => void;
  autoStart?: boolean;
  onWorkspaceChange?: (workspace: 'intelligence' | 'teams') => void;
}

export default function TourGuide({ workspace, onClose, autoStart = false, onWorkspaceChange }: TourGuideProps) {
  const [showTourButton, setShowTourButton] = useState(true);
  const [tourPhase, setTourPhase] = useState<'intelligence' | 'teams' | 'completed'>('intelligence');

  const intelligenceSteps: Array<{
    intro: string;
    element?: string;
    position?: TooltipPosition;
  }> = [
    {
      intro: "👋 Welcome to your Intelligence Workspace! Let's take a quick tour to get you started.",
    },
    {
      element: '[data-tour="workspace-switch"]',
      intro: "🔄 Use this button to switch between Intelligence and Teams workspaces. Each workspace has different AI agents and capabilities designed for specific tasks.",
      position: 'bottom'
    },
    {
      element: '[data-tour="search-bar"]',
      intro: "🔍 Search through your intelligence data, insights, and analytics using this search bar.",
      position: 'bottom'
    },
    {
      element: '[data-tour="agent-grid"]',
      intro: "🤖 These are your Intelligence Agents. Available agents are fully functional, while grayed-out agents are coming soon.",
      position: 'top'
    },
    {
      element: '[data-tour="available-agent"]',
      intro: "✅ Available agents show real-time stats and have working action buttons. Click to access their full dashboards.",
      position: 'left'
    },
    {
      element: '[data-tour="unavailable-agent"]',
      intro: "🚧 Coming soon agents are currently being developed. They'll be available in future updates.",
      position: 'right'
    },
    {
      element: '[data-tour="overview-dashboard"]',
      intro: "📊 The Intelligence Overview shows key metrics: emails analyzed, insights generated, opportunities found, and response times.",
      position: 'top'
    },
    {
      intro: "🎯 Great! You've completed the Intelligence workspace tour. Next, let's explore the Teams workspace to see how you can coordinate with your team!"
    }
  ];

  const teamsSteps: Array<{
    intro: string;
    element?: string;
    position?: TooltipPosition;
  }> = [
    {
      intro: "👋 Welcome to your Teams Workspace! Let's explore how to coordinate tasks and manage projects.",
    },
    {
      element: '[data-tour="workspace-switch"]',
      intro: "🔄 You can switch back to Intelligence workspace anytime using this button. Teams focuses on collaboration and project management.",
      position: 'bottom'
    },
    {
      element: '[data-tour="search-bar"]',
      intro: "🔍 Search through tasks, team communications, and project data using this search bar.",
      position: 'bottom'
    },
    {
      element: '[data-tour="agent-grid"]',
      intro: "🤖 These are your Team Agents. Each specializes in different aspects of team collaboration and project management.",
      position: 'top'
    },
    {
      element: '[data-tour="available-agent"]',
      intro: "✅ Available agents show live activity stats. Click their buttons to access kanban boards, communications, and more.",
      position: 'left'
    },
    {
      element: '[data-tour="unavailable-agent"]',
      intro: "🚧 Coming soon agents will add more team collaboration features in future updates.",
      position: 'right'
    },
    {
      element: '[data-tour="overview-dashboard"]',
      intro: "📊 The Teams Overview tracks processed tasks, communications, decisions made, and questions answered.",
      position: 'top'
    },
    {
      intro: "🎉 Perfect! You're ready to start coordinating with your team. Click on any available agent to begin!"
    }
  ];

  const startTour = () => {
    const isIntelligenceTour = tourPhase === 'intelligence';
    const steps = isIntelligenceTour ? intelligenceSteps : teamsSteps;

    const intro = introJs();
    intro.setOptions({
      steps: steps,
      showProgress: true,
      showBullets: false,
      exitOnOverlayClick: true,
      exitOnEsc: true,
      nextLabel: 'Next →',
      prevLabel: '← Back',
      doneLabel: isIntelligenceTour ? 'Continue to Teams →' : 'Start Exploring! 🚀',
      skipLabel: 'Skip Tour',
      hidePrev: false,
      hideNext: false,
      scrollToElement: true,
      overlayOpacity: 0.7,
      tooltipClass: 'custom-tour-tooltip',
      highlightClass: 'custom-tour-highlight'
    });

    intro.oncomplete(() => {
      if (isIntelligenceTour) {
        // Switch to teams workspace and continue tour
        setTourPhase('teams');
        if (onWorkspaceChange) {
          onWorkspaceChange('teams');
        }
        // Small delay to let workspace switch complete
        setTimeout(() => {
          startTour();
        }, 1000);
      } else {
        // Completed both tours
        setTourPhase('completed');
        setShowTourButton(false);
        localStorage.setItem('tour-completed-intelligence', 'true');
        localStorage.setItem('tour-completed-teams', 'true');
        if (onClose) onClose();
      }
    });

    intro.onexit(() => {
      localStorage.setItem('tour-skipped-intelligence', 'true');
      localStorage.setItem('tour-skipped-teams', 'true');
      if (onClose) onClose();
    });

    intro.start();
  };

  // Expose startTour method for external use
  useEffect(() => {
    if (autoStart) {
      const timer = setTimeout(() => {
        startTour();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoStart]);

  useEffect(() => {
    // Check if user has seen the tour for this workspace
    const hasSeenTour = localStorage.getItem(`tour-completed-${workspace}`) === 'true' ||
                       localStorage.getItem(`tour-skipped-${workspace}`) === 'true';

    if (hasSeenTour) {
      setShowTourButton(false);
    }
  }, [workspace]);

  if (!showTourButton) return null;

  return (
    <>
      {/* Tour Trigger Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={startTour}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200"
          title="Take a guided tour"
        >
          <HelpCircle className="w-5 h-5" />
        </Button>
      </div>

      {/* Custom Tour Styles */}
      <style>{`
        .custom-tour-tooltip {
          background: white !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 12px !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }

        .custom-tour-highlight {
          border-radius: 8px !important;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3) !important;
        }

        .introjs-tooltip-title {
          font-size: 18px !important;
          font-weight: 600 !important;
          color: #1f2937 !important;
          margin-bottom: 8px !important;
        }

        .introjs-tooltip-text {
          font-size: 16px !important;
          line-height: 1.5 !important;
          color: #4b5563 !important;
        }

        .introjs-button {
          border-radius: 6px !important;
          font-weight: 500 !important;
          padding: 8px 16px !important;
          transition: all 0.2s !important;
        }

        .introjs-nextbutton {
          background: #3b82f6 !important;
          color: white !important;
          border: none !important;
        }

        .introjs-nextbutton:hover {
          background: #2563eb !important;
        }

        .introjs-prevbutton {
          background: #f3f4f6 !important;
          color: #374151 !important;
          border: 1px solid #d1d5db !important;
        }

        .introjs-skipbutton {
          color: #6b7280 !important;
          font-weight: 400 !important;
        }

        .introjs-progress {
          background: #e5e7eb !important;
          border-radius: 4px !important;
        }

        .introjs-progressbar {
          background: #3b82f6 !important;
          border-radius: 4px !important;
        }
      `}</style>
    </>
  );
}