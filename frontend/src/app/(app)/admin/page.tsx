'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatNumber, formatDate, getInitials } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Users, Activity, MessageSquare, TrendingUp, Search, Shield, Trash2,
  UserCheck, BarChart3, Loader2,
} from 'lucide-react';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'users' | 'ai'>('overview');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => { const { data } = await adminApi.dashboard(); return data; },
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: async () => { const { data } = await adminApi.users({ page: String(page), limit: '10', search }); return data; },
    enabled: tab === 'users',
  });

  const { data: aiData } = useQuery({
    queryKey: ['admin-ai-usage'],
    queryFn: async () => { const { data } = await adminApi.aiUsage(); return data; },
    enabled: tab === 'ai',
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: any) => adminApi.updateUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const stats = [
    { label: 'Total Users', value: dashData?.stats?.totalUsers || 0, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Users (7d)', value: dashData?.stats?.activeUsers || 0, icon: UserCheck, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Transactions', value: dashData?.stats?.totalTransactions || 0, icon: Activity, color: 'bg-purple-50 text-purple-600' },
    { label: 'AI Messages', value: dashData?.stats?.totalChatMessages || 0, icon: MessageSquare, color: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Shield className="h-6 w-6" /> Admin Panel</h1>
        <p className="text-gray-500">Manage users, transactions, and system analytics</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[{ key: 'overview', label: 'Overview' }, { key: 'users', label: 'Users' }, { key: 'ai', label: 'AI Usage' }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <Card className="stat-card"><CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm text-gray-500">{s.label}</p><p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(s.value)}</p></div>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${s.color}`}><Icon className="h-6 w-6" /></div>
                    </div>
                  </CardContent></Card>
                </motion.div>
              );
            })}
          </div>

          {/* Recent Users */}
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Users</CardTitle></CardHeader>
            <CardContent>
              {dashLoading ? <div className="text-center py-4 text-gray-400">Loading...</div> : (
                <div className="divide-y divide-gray-100">
                  {dashData?.recentUsers?.map((u: any) => (
                    <div key={u.id} className="flex items-center gap-3 py-3">
                      <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center"><span className="text-xs font-medium text-gray-600">{getInitials(u.name)}</span></div>
                      <div className="flex-1"><p className="text-sm font-medium text-gray-900">{u.name}</p><p className="text-xs text-gray-500">{u.email}</p></div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'ADMIN' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                      <span className="text-xs text-gray-400">{u._count.transactions} txns</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'users' && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input placeholder="Search users..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" /></div>
            </div>
            <div className="divide-y divide-gray-100">
              {usersLoading ? <div className="text-center py-8 text-gray-400">Loading...</div> : usersData?.users?.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 py-3">
                  <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center"><span className="text-xs font-medium text-gray-600">{getInitials(u.name)}</span></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email} · Joined {formatDate(u.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={u.role} onValueChange={(role) => roleMutation.mutate({ id: u.id, role })}>
                      <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">User</SelectItem><SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <button onClick={() => { if (confirm('Delete this user?')) deleteMutation.mutate(u.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'ai' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Messages', value: aiData?.usage?.totalMessages || 0 },
            { label: 'This Month', value: aiData?.usage?.messagesThisMonth || 0 },
            { label: 'This Week', value: aiData?.usage?.messagesThisWeek || 0 },
            { label: 'Active Chatters', value: aiData?.usage?.activeChatters || 0 },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="stat-card"><CardContent className="p-6">
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(s.value)}</p>
              </CardContent></Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
