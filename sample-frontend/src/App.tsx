import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import LandingPage from "@/pages/LandingPage";
import EmailAuth from "@/pages/EmailAuth";
import Dashboard from "@/pages/Dashboard";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <CompanyProvider>
            <div className="min-h-screen w-full">
              <Switch>
                <Route path="/" component={LandingPage} />
                <Route path="/auth/email" component={EmailAuth} />
                <Route path="/dashboard" component={Dashboard} />
                <Route>
                  {() => <div className="flex items-center justify-center min-h-screen">404 - Not Found</div>}
                </Route>
              </Switch>
            </div>
            <Toaster />
            <Sonner />
          </CompanyProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;