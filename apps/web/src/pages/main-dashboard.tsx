import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import TourGuide from "@/components/TourGuide";
import WelcomeTour from "@/components/WelcomeTour";
import TourControls from "@/components/TourControls";
import { useFirstTimeUser } from "@/hooks/useFirstTimeUser";
import IntelligenceAgents from "@/pages/intelligence";
import Teams from "@/pages/teams";
import UserTasks from "@/pages/user-tasks";
import TodoPage from "@/pages/todo";
import TodoAgentPage from "@/pages/agents/todo";
import AlexPage from "@/pages/agents/alex";
import FAQPage from "@/pages/agents/faq";
import PollyPage from "@/pages/agents/polly";
import T5TPage from "@/pages/agents/t5t";
import AutoRouterPage from "@/pages/agents/auto-router";
import { useAgentUsage } from "@/hooks/useAgentUsage";

export default function MainDashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { getUsedAgents } = useAgentUsage();
  const { isFirstTime, markTourCompleted } = useFirstTimeUser();
  const [startTour, setStartTour] = useState<'intelligence' | 'teams' | null>(null);

  // Determine current workspace based on URL
  const getCurrentWorkspace = (): 'intelligence' | 'teams' => {
    if (location.startsWith('/teams')) return 'teams';
    return 'intelligence';
  };

  const [currentWorkspace, setCurrentWorkspace] = useState<'intelligence' | 'teams'>(getCurrentWorkspace());

  // Update workspace when URL changes
  useEffect(() => {
    setCurrentWorkspace(getCurrentWorkspace());
  }, [location]);

  // Update page title based on current route
  useEffect(() => {
    const getPageTitle = () => {
      if (location.startsWith('/intelligence/t5t') || location === '/intelligence/t5t') {
        return 'Top 5 Things - InboxLeap';
      }
      if (location.startsWith('/teams/todo') || location === '/teams/todo') {
        return 'Task Manager - InboxLeap';
      }
      if (location.startsWith('/teams/alex') || location === '/teams/alex') {
        return 'Document Analyzer - InboxLeap';
      }
      if (location.startsWith('/teams/faq') || location === '/teams/faq') {
        return 'Knowledge Base - InboxLeap';
      }
      if (location.startsWith('/teams/polly') || location === '/teams/polly') {
        return 'Poll Creator - InboxLeap';
      }
      if (location.startsWith('/agent') || location === '/agent') {
        return 'Auto Router - InboxLeap';
      }
      if (location.startsWith('/tasks')) {
        return 'My Tasks - InboxLeap';
      }
      if (location === '/intelligence') {
        return 'Intelligence Workspace - InboxLeap';
      }
      if (location === '/teams') {
        return 'Teams Workspace - InboxLeap';
      }
      return 'Dashboard - InboxLeap';
    };

    document.title = getPageTitle();
  }, [location]);

  // Handle workspace change
  const handleWorkspaceChange = (workspace: 'intelligence' | 'teams') => {
    setCurrentWorkspace(workspace);
    setLocation(workspace === 'intelligence' ? '/intelligence' : '/teams');
  };

  // Handle tour start from welcome modal
  const handleStartTour = (workspace: 'intelligence' | 'teams') => {
    setStartTour(workspace);
    handleWorkspaceChange(workspace);
  };

  // Handle tour skip
  const handleSkipTour = () => {
    markTourCompleted('intelligence');
    markTourCompleted('teams');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading InboxLeap...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via auth hooks
  }

  const renderContent = () => {
    // Handle specific agent routes
    if (location.startsWith('/intelligence/t5t') || location === '/intelligence/t5t') {
      return <T5TPage />;
    }
    if (location.startsWith('/teams/todo') || location === '/teams/todo' || location === '/todo') {
      return <TodoPage />;
    }
    if (location.startsWith('/teams/alex') || location === '/teams/alex') {
      return <AlexPage />;
    }
    if (location.startsWith('/teams/faq') || location === '/teams/faq') {
      return <FAQPage />;
    }
    if (location.startsWith('/teams/polly') || location === '/teams/polly') {
      return <PollyPage />;
    }
    if (location.startsWith('/agent') || location === '/agent') {
      return <AutoRouterPage />;
    }
    if (location.startsWith('/tasks')) {
      return <UserTasks />;
    }

    // Default workspace content
    return currentWorkspace === 'intelligence' ? <IntelligenceAgents /> : <Teams />;
  };

  const getWorkspaceBackground = () => {
    // Todo page should have no gradient background (like teams)
    if (location.startsWith('/teams/todo') || location === '/teams/todo' || location === '/todo') {
      return '';
    }
    return currentWorkspace === 'intelligence'
      ? 'bg-gradient-to-br from-blue-50 to-indigo-100'
      : 'bg-gradient-to-br from-green-50 to-emerald-100';
  };

  return (
    <div className={`min-h-screen ${getWorkspaceBackground()}`}>
      <Header
        workspace={currentWorkspace}
        onWorkspaceChange={handleWorkspaceChange}
      />

      <div className="flex-1">
        {renderContent()}
      </div>

      {/* Welcome Tour for first-time users */}
      <WelcomeTour
        onStartTour={handleStartTour}
        onSkip={handleSkipTour}
      />

      {/* Tour Guide - only show on main workspace pages */}
      {(location === '/intelligence' || location === '/teams') && (
        <TourGuide
          workspace={currentWorkspace}
          autoStart={startTour === currentWorkspace}
          onClose={() => setStartTour(null)}
          onWorkspaceChange={handleWorkspaceChange}
        />
      )}

      {/* Development Tour Controls */}
      <TourControls />
    </div>
  );
}
