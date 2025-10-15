import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { CopilotContextProvider } from "@/contexts/CopilotContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { IdentityProvider } from "@/contexts/IdentityContext";
import CopilotSidebar from "@/components/CopilotSidebar";
import { useState } from "react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import EmailAuth from "@/pages/email-auth";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import SettingsPage from "@/pages/settings";
import IdentitiesPage from "@/pages/identities";
import TestPage from "@/pages/test";
import MainDashboard from "@/pages/main-dashboard";
import TodoPage from "@/pages/todo";

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  const toggleCopilot = () => setIsCopilotOpen(!isCopilotOpen);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Switch>
        {!isAuthenticated ? (
          <>
            <Route path="/" component={Landing} />
            <Route path="/auth/email" component={EmailAuth} />
            <Route path="/email-auth" component={EmailAuth} />
            <Route path="/forgot-password" component={ForgotPassword} />
            <Route path="/reset-password" component={ResetPassword} />
          </>
        ) : (
          <>
            <Route path="/" component={MainDashboard} />
            <Route path="/dashboard" component={MainDashboard} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/identities" component={IdentitiesPage} />
            <Route path="/test" component={TestPage} />
            <Route path="/intelligence" component={MainDashboard} />
            <Route path="/intelligence/t5t" component={MainDashboard} />
            <Route path="/teams" component={MainDashboard} />
            <Route path="/teams/todo" component={MainDashboard} />
            <Route path="/teams/alex" component={MainDashboard} />
            <Route path="/teams/faq" component={MainDashboard} />
            <Route path="/teams/polly" component={MainDashboard} />
            <Route path="/agent" component={MainDashboard} />
            <Route path="/projects" component={MainDashboard} />
            <Route path="/tasks" component={MainDashboard} />
            <Route path="/todo" component={MainDashboard} />
            <Route path="/polling/:agentId?" component={MainDashboard} />
            <Route path="/polling" component={MainDashboard} />
            <Route path="/project/:projectId" component={MainDashboard} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>

      {/* Copilot Sidebar - only show when authenticated */}
      {isAuthenticated && (
        <CopilotSidebar isOpen={isCopilotOpen} onToggle={toggleCopilot} />
      )}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CompanyProvider>
          <IdentityProvider>
            <CopilotContextProvider>
              <Toaster />
              <AppContent />
            </CopilotContextProvider>
          </IdentityProvider>
        </CompanyProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
