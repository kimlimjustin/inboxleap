import { Button } from "@/components/ui/button";
import { Brain, Users, Search, Settings } from "lucide-react";
import NotificationCenter from "@/components/NotificationCenter";
import { useLocation } from "wouter";

interface WorkspaceSelectorProps {
  workspace: 'intelligence' | 'teams';
  onWorkspaceChange: (workspace: 'intelligence' | 'teams') => void;
}

export default function WorkspaceSelector({ workspace, onWorkspaceChange }: WorkspaceSelectorProps) {
  const [, setLocation] = useLocation();
  const getWorkspaceIcon = () => workspace === 'intelligence' ? Brain : Users;
  const getWorkspaceColors = () => ({
    iconBg: workspace === 'intelligence' ? 'bg-blue-600' : 'bg-green-600',
    switchBtn: workspace === 'intelligence'
      ? 'border-green-200 hover:bg-green-50 text-green-700'
      : 'border-blue-200 hover:bg-blue-50 text-blue-700',
    searchFocus: workspace === 'intelligence' ? 'focus:ring-blue-500' : 'focus:ring-green-500'
  });

  const WorkspaceIcon = getWorkspaceIcon();
  const colors = getWorkspaceColors();

  return (
    <div className="bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3" data-tour="workspace-selector">
              <div className={`w-10 h-10 ${colors.iconBg} rounded-lg flex items-center justify-center`}>
                <WorkspaceIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {workspace === 'intelligence' ? 'Intelligence Workspace' : 'Teams Workspace'}
                </h1>
                <p className="text-sm text-gray-600">
                  {workspace === 'intelligence'
                    ? 'Strategic insights & analytics dashboard'
                    : 'Task coordination & project management'}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onWorkspaceChange(workspace === 'intelligence' ? 'teams' : 'intelligence')}
              className={`ml-6 ${colors.switchBtn}`}
              data-tour="workspace-switch"
            >
              Switch to {workspace === 'intelligence' ? 'Teams' : 'Intelligence'}
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" data-tour="search-bar">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${workspace}...`}
                className={`pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 ${colors.searchFocus} w-64`}
              />
            </div>
            <NotificationCenter />
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-gray-100"
              onClick={() => setLocation('/settings')}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}