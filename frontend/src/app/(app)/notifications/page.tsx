"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { motion } from "framer-motion";
import { Bell, CheckCheck, Trash2, AlertTriangle, Target, FileText } from "lucide-react";

const typeIcons: Record<string, React.ElementType> = {
  BUDGET_ALERT: AlertTriangle,
  OVERSPENDING: AlertTriangle,
  GOAL_PROGRESS: Target,
  WEEKLY_REPORT: FileText,
  MONTHLY_REPORT: FileText,
  SYSTEM: Bell,
};

const typeColors: Record<string, string> = {
  BUDGET_ALERT: "bg-yellow-100 text-yellow-700",
  OVERSPENDING: "bg-red-100 text-red-700",
  GOAL_PROGRESS: "bg-green-100 text-green-700",
  WEEKLY_REPORT: "bg-blue-100 text-blue-700",
  MONTHLY_REPORT: "bg-purple-100 text-purple-700",
  SYSTEM: "bg-gray-100 text-gray-700",
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const result = (data?.data as any)?.data || {};
  const notifications: any[] = result.notifications || [];
  const unreadCount: number = result.unreadCount || 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "No unread notifications"}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => markAllReadMutation.mutate()}>
              <CheckCheck className="h-4 w-4" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bell className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <p>No notifications yet. They'll appear here when you get budget alerts, goal updates, and reports.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif: any) => {
            const Icon = typeIcons[notif.type] || Bell;
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`rounded-xl border p-4 transition-colors ${!notif.read ? "bg-indigo-50/50 border-indigo-100" : "bg-white"}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2 ${typeColors[notif.type] || "bg-gray-100 text-gray-700"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{notif.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!notif.read && (
                          <button onClick={() => markReadMutation.mutate(notif.id)} className="rounded p-1.5 text-gray-400 hover:bg-indigo-100 hover:text-indigo-600" title="Mark as read">
                            <CheckCheck className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => deleteMutation.mutate(notif.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{formatDate(notif.createdAt)}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
