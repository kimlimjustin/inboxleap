import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface PersistentNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  persistent: boolean;
  actions?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'outline';
  }[];
}

interface NotificationCenterProps {
  className?: string;
}

const getNotificationIcon = (type: PersistentNotification['type']) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-600" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-orange-600" />;
    case 'info':
      return <Info className="w-4 h-4 text-blue-600" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
};

const getNotificationColorClasses = (type: PersistentNotification['type']) => {
  switch (type) {
    case 'success':
      return 'border-green-200 bg-green-50';
    case 'error':
      return 'border-red-200 bg-red-50';
    case 'warning':
      return 'border-orange-200 bg-orange-50';
    case 'info':
      return 'border-blue-200 bg-blue-50';
    default:
      return 'border-gray-200 bg-gray-50';
  }
};

// Global state for persistent notifications
let persistentNotifications: PersistentNotification[] = [];
let notificationListeners: ((notifications: PersistentNotification[]) => void)[] = [];

export const notificationCenter = {
  add: (notification: Omit<PersistentNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: PersistentNotification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    };

    persistentNotifications = [newNotification, ...persistentNotifications];
    notificationListeners.forEach(listener => listener(persistentNotifications));
  },

  markAsRead: (id: string) => {
    persistentNotifications = persistentNotifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    );
    notificationListeners.forEach(listener => listener(persistentNotifications));
  },

  remove: (id: string) => {
    persistentNotifications = persistentNotifications.filter(n => n.id !== id);
    notificationListeners.forEach(listener => listener(persistentNotifications));
  },

  clear: () => {
    persistentNotifications = [];
    notificationListeners.forEach(listener => listener(persistentNotifications));
  },

  markAllAsRead: () => {
    persistentNotifications = persistentNotifications.map(n => ({ ...n, read: true }));
    notificationListeners.forEach(listener => listener(persistentNotifications));
  },
};

export default function NotificationCenter({ className }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<PersistentNotification[]>(persistentNotifications);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    notificationListeners.push(setNotifications);
    return () => {
      const index = notificationListeners.indexOf(setNotifications);
      if (index > -1) {
        notificationListeners.splice(index, 1);
      }
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = (notification: PersistentNotification) => {
    if (!notification.read) {
      notificationCenter.markAsRead(notification.id);
    }
  };

  const handleMarkAllAsRead = () => {
    notificationCenter.markAllAsRead();
  };

  const handleClearAll = () => {
    notificationCenter.clear();
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("relative hover:bg-gray-100", className)}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 p-0"
        sideOffset={5}
      >
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="text-xs h-7"
                >
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-xs h-7"
                >
                  Clear all
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No notifications
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-gray-50 border-l-4",
                    getNotificationColorClasses(notification.type),
                    !notification.read && "bg-blue-50/30"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              !notification.read && "font-semibold"
                            )}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {notification.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              notificationCenter.remove(notification.id);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                        {notification.actions && notification.actions.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {notification.actions.map((action, index) => (
                              <Button
                                key={index}
                                variant={action.variant || 'outline'}
                                size="sm"
                                className="text-xs h-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  action.onClick();
                                }}
                              >
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}