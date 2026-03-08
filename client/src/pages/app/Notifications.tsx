import { useState, useEffect } from "react";
import { Bell, Check, Calendar, CreditCard, Briefcase, Info, AlertTriangle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  channel: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

const typeIcons: Record<string, React.ReactNode> = {
  booking: <Calendar className="h-5 w-5 text-blue-500" />,
  payment: <CreditCard className="h-5 w-5 text-green-500" />,
  event: <Calendar className="h-5 w-5 text-purple-500" />,
  job: <Briefcase className="h-5 w-5 text-orange-500" />,
  system: <Info className="h-5 w-5 text-slate-500" />,
  verification: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
};

const typeLabels: Record<string, string> = {
  all: "All Notifications",
  booking: "Bookings",
  payment: "Payments",
  event: "Events",
  job: "Jobs",
  system: "System",
  verification: "Verification",
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const fetchNotifications = async (pageNum: number, reset = false) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((pageNum - 1) * limit).toString(),
      });
      if (filter !== "all") {
        params.append("type", filter);
      }
      
      const res = await fetch(`/api/notifications/${user.uid}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        const newNotifications = data.notifications || [];
        
        if (reset) {
          setNotifications(newNotifications);
        } else {
          setNotifications((prev) => [...prev, ...newNotifications]);
        }
        
        setTotalCount(data.totalCount || 0);
        setHasMore(newNotifications.length === limit);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchNotifications(1, true);
  }, [user, filter]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage);
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/notifications/${user.uid}/read/${notificationId}`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
        );
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/notifications/${user.uid}/read-all`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-muted-foreground">
            {totalCount} total notifications{unreadCount > 0 && `, ${unreadCount} unread`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-notification-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(typeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value} data-testid={`filter-option-${value}`}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              onClick={markAllAsRead}
              data-testid="button-mark-all-read-page"
            >
              <Check className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Bell className="h-12 w-12 mb-3 text-slate-300" />
              <span className="text-lg font-medium">No notifications</span>
              <span className="text-sm">
                {filter !== "all" ? "Try changing the filter" : "You're all caught up!"}
              </span>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 hover:bg-slate-50 transition-colors",
                    !notification.isRead && "bg-primary/5"
                  )}
                  data-testid={`notification-row-${notification.id}`}
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                        {typeIcons[notification.type] || typeIcons.system}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className={cn(
                              "text-base",
                              !notification.isRead && "font-semibold"
                            )}>
                              {notification.title}
                            </p>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {typeLabels[notification.type] || notification.type}
                            </Badge>
                            {!notification.isRead && (
                              <div className="h-2 w-2 rounded-full bg-primary" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatTime(notification.createdAt)}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-shrink-0"
                            onClick={() => markAsRead(notification.id)}
                            data-testid={`button-mark-read-${notification.id}`}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {hasMore && notifications.length > 0 && (
            <div className="p-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={loadMore}
                disabled={loading}
                data-testid="button-load-more"
              >
                {loading ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
