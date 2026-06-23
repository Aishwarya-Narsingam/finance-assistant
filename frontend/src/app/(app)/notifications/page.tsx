'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Bell, CheckCheck, Trash2, AlertTriangle, TrendingUp, Target, Mail, Info,
} from 'lucide-react';

const TYPE_ICONS: Record<string, any> = {
  BUDGET_ALERT: AlertTriangle, OVERSPENDING: AlertTriangle, GOAL_PROGRESS: Target,
  WEEKLY_REPORT: Mail, MONTHLY_REPORT: Mail, SYSTEM: Info,
};
const TYPE_COLORS: Record<string, string> = {
  BUDGET_ALERT: 'bg-yellow-50 text-yellow-600', OVERSPENDING: 'bg-red-50 text-red-600',
  GOAL_PROGRESS: 'bg-blue-50 text-blue-600', WEEKLY_REPORT: 'bg-purple-50 text-purple-600',
  MONTHLY_REPORT: 'bg-purple-50 text-purple-600', SYSTEM: 'bg-gray-50 text-gray-600',
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: async () => { const { data } = await notificationsApi.list({ unreadOnly: unreadOnly ? 'true' : undefined }); return data; },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500">
            {data?.unreadCount ? `${data.unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setUnreadOnly(!unreadOnly)}>
            {unreadOnly ? 'Show All' : 'Unread Only'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => markAllMutation.mutate()}>
            <CheckCheck className="h-4 w-4 mr-2" /> Mark All Read
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : data?.notifications?.length > 0 ? (
        <div className="space-y-2">
          {data.notifications.map((n: any, i: number) => {
            const Icon = TYPE_ICONS[n.type] || Bell;
            return (
              <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className={`card-hover ${!n.read ? 'border-l-4 border-l-black' : ''}`}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${TYPE_COLORS[n.type] || 'bg-gray-50 text-gray-600'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-semibold ${n.read ? 'text-gray-700' : 'text-gray-900'}`}>{n.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDateTime(n.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!n.read && (
                        <button onClick={() => markReadMutation.mutate(n.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Mark as read">
                          <CheckCheck className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => deleteMutation.mutate(n.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg mb-2">No notifications</p>
          <p className="text-sm">You&apos;re all caught up!</p>
        </div>
      )}
    </div>
  );
}
