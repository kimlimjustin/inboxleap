import { Bell, Brain, Users, Search, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import IdentitySelector from "@/components/IdentitySelector";
import NotificationCenter from "@/components/NotificationCenter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: 'email_processed' | 'reply_processed' | 'email_failed';
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
}

interface HeaderProps {
  workspace?: 'intelligence' | 'teams';
  onWorkspaceChange?: (workspace: 'intelligence' | 'teams') => void;
}

export default function Header({ workspace, onWorkspaceChange }: HeaderProps = {}) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket for real-time notifications
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('🔔 [NOTIFICATIONS] WebSocket connected');
    };
    
    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    websocket.onclose = () => {
      console.log('🔔 [NOTIFICATIONS] WebSocket disconnected');
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (!ws || ws.readyState === WebSocket.CLOSED) {
          setWs(null);
        }
      }, 3000);
    };
    
    setWs(websocket);
    
    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, []);

  const handleWebSocketMessage = (data: any) => {
    const timestamp = new Date();
    let notification: Notification | null = null;

    switch (data.type) {
      case 'email_processed':
        notification = {
          id: `${Date.now()}-email-processed`,
          type: 'email_processed',
          title: 'New Email Processed',
          description: `Created ${data.tasksCreated} tasks from "${data.subject?.substring(0, 50)}..."`,
          timestamp,
          read: false,
        };
        break;
      
      case 'reply_processed':
        notification = {
          id: `${Date.now()}-reply-processed`,
          type: 'reply_processed',
          title: 'Reply Processed',
          description: `Updated ${data.tasksUpdated} tasks from your reply`,
          timestamp,
          read: false,
        };
        break;
      
      case 'email_failed':
        notification = {
          id: `${Date.now()}-email-failed`,
          type: 'email_failed',
          title: 'Email Processing Failed',
          description: `Failed to process email: "${data.subject?.substring(0, 50)}..."`,
          timestamp,
          read: false,
        };
        break;
    }

    if (notification) {
      setNotifications(prev => [notification!, ...prev.slice(0, 9)]); // Keep only 10 notifications
      setNotificationCount(prev => prev + 1);
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    );
    setNotificationCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setNotificationCount(0);
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'email_processed':
        return '📧';
      case 'reply_processed':
        return '💬';
      case 'email_failed':
        return '❌';
      default:
        return '📧';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

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
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side: Logo, Company Selector, Workspace */}
          <div className="flex items-center gap-6">
            {/* InboxLeap Logo */}
            <div className="flex-shrink-0 flex items-center">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">📧</span>
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                InboxLeap
              </h1>
            </div>

            {/* Identity Selector */}
            <div>
              <IdentitySelector />
            </div>

            {/* Workspace Selector - only show if workspace is provided */}
            {workspace && (
              <>
                <div className="h-8 w-px bg-gray-300"></div>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 ${colors.iconBg} rounded-lg flex items-center justify-center`}>
                    <WorkspaceIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">
                      {workspace === 'intelligence' ? 'Intelligence' : 'Teams'}
                    </h2>
                  </div>
                  {onWorkspaceChange && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onWorkspaceChange(workspace === 'intelligence' ? 'teams' : 'intelligence')}
                      className={`${colors.switchBtn} h-8 text-xs`}
                    >
                      Switch to {workspace === 'intelligence' ? 'Teams' : 'Intelligence'}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right side: Search, Notifications, Settings, User Menu */}
          <div className="flex items-center gap-3">
            {/* Search Bar - only show if workspace is provided */}
            {workspace && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${workspace}...`}
                  className={`pl-10 pr-4 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 ${colors.searchFocus} w-48`}
                />
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative hover:bg-gray-100 transition-colors">
                  <Bell className="h-5 w-5 text-gray-600" />
                  {notificationCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 px-1 py-0.5 min-w-[16px] h-4 flex items-center justify-center text-xs animate-pulse"
                    >
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between p-3 border-b">
                  <h3 className="font-semibold text-sm">Notifications</h3>
                  {notificationCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllAsRead}
                      className="h-8 px-2 text-xs text-blue-600 hover:text-blue-700"
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
                
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No notifications yet</p>
                    <p className="text-xs">Email processing notifications will appear here</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className={cn(
                          "flex items-start space-x-3 p-3 cursor-pointer hover:bg-gray-50 focus:bg-gray-50",
                          !notification.read && "bg-blue-50 hover:bg-blue-100 focus:bg-blue-100"
                        )}
                        onClick={() => markAsRead(notification.id)}
                      >
                        <div className="flex-shrink-0 mt-1">
                          <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {notification.description}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatTime(notification.timestamp)}
                          </p>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings Button */}
            {workspace && (
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-gray-100"
                onClick={() => setLocation('/settings')}
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-3 hover:bg-gray-100 rounded-lg p-2 transition-colors">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-gray-900">
                      {(user as any)?.firstName || (user as any)?.lastName 
                        ? `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim()
                        : "User"
                      }
                    </p>
                    <p className="text-xs text-gray-500">{(user as any)?.email || ""}</p>
                  </div>
                  <Avatar className="h-8 w-8 ring-2 ring-gray-200">
                    <AvatarImage src={(user as any)?.profileImageUrl || ""} alt="User profile" />
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold">
                      {getInitials((user as any)?.firstName, (user as any)?.lastName)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                  onClick={() => setLocation('/dashboard')} 
                  className="cursor-pointer md:hidden"
                >
                  <span className="mr-2">🏠</span>
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setLocation('/my-tasks')} 
                  className="cursor-pointer md:hidden"
                >
                  <span className="mr-2">📋</span>
                  My Tasks
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation('/todo')}
                  className="cursor-pointer md:hidden"
                >
                  <span className="mr-2">📊</span>
                  Task Board
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation('/todo')}
                  className="cursor-pointer"
                >
                  <span className="mr-2">✅</span>
                  Todo Management
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation('/identities')}
                  className="cursor-pointer"
                >
                  <span className="mr-2">🔑</span>
                  Identity Management
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation('/polling')}
                  className="cursor-pointer md:hidden"
                >
                  <span className="mr-2">🧠</span>
                  Intelligence
                </DropdownMenuItem>
                <DropdownMenuSeparator className="md:hidden" />
                <DropdownMenuItem
                  onClick={() => setLocation('/settings')} 
                  className="cursor-pointer"
                >
                  <span className="mr-2">⚙️</span>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <span className="mr-2">🚪</span>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
