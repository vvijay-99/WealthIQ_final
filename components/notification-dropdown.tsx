'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, InAppNotification } from '@/lib/notification-context';
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  AlertTriangle,
  TrendingUp,
  Activity,
  Calendar,
  Settings,
  ArrowRight,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function NotificationDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
  } = useNotifications();

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (markingAllRead || unreadCount === 0) return;

    setMarkingAllRead(true);
    try {
      await markAllAsRead();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleNotificationClick = (notification: InAppNotification) => {
    markAsRead(notification.id);
    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      const now = new Date();
      const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSecs < 60) return 'Just now';
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
      return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getNotificationIcon = (type: InAppNotification['type']) => {
    switch (type) {
      case 'health_score':
        return <Activity className="h-4 w-4 text-primary" />;
      case 'spending_risk':
        return <AlertTriangle className="h-4 w-4 text-danger" />;
      case 'monthly_digest':
        return <Calendar className="h-4 w-4 text-emerald-500" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
          aria-label="View notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white shadow-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 shadow-lg border border-border bg-popover"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {unreadCount} unread
              </Badge>
            ) : null}
          </div>
          {notifications.length > 0 && (
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={markingAllRead}
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground disabled:opacity-60"
                >
                  {markingAllRead ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      Marking all read...
                    </>
                  ) : (
                    <>
                      <CheckCheck className="h-3.5 w-3.5 mr-1" />
                      Mark all read
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-7 text-xs px-2 text-muted-foreground hover:text-danger"
                title="Clear all notifications"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Notifications List */}
        <ScrollArea className="max-h-[360px] divide-y divide-border">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-2">
                <Bell className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                Health Score changes, spending risk warnings, and monthly summaries will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={cn(
                  'group relative flex items-start gap-3 p-3.5 transition-colors hover:bg-muted/40 cursor-pointer',
                  !notif.read ? 'bg-primary/5' : 'bg-transparent'
                )}
                onClick={() => handleNotificationClick(notif)}
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0 rounded-full bg-background p-1.5 border border-border shadow-xs">
                  {getNotificationIcon(notif.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-baseline justify-between gap-1">
                    <p
                      className={cn(
                        'text-xs truncate font-medium',
                        !notif.read ? 'text-foreground font-semibold' : 'text-muted-foreground'
                      )}
                    >
                      {notif.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                      {formatTimestamp(notif.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                    {notif.message}
                  </p>
                  {notif.link && (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                      View details
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  )}
                </div>

                {/* Unread dot / Dismiss Button */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {!notif.read && (
                    <span className="h-2 w-2 rounded-full bg-primary mt-1" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearNotification(notif.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-opacity"
                    title="Dismiss"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-border p-2 bg-muted/20 flex items-center justify-between">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Notification Settings</span>
          </Link>
          <span className="text-[11px] text-muted-foreground pr-2">WealthIQ In-App Alerts</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
