'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, getCategoryColor, getCategoryIcon } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  Plus,
  MessageSquare,
  PiggyBank,
  Download,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend,
} from 'recharts';

const CHART_COLORS = ['#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#64748B', '#14B8A6', '#F43F5E', '#10B981', '#3B82F6', '#A855F7', '#9CA3AF'];

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const { data } = await transactionsApi.summary();
      return data;
    },
  });

  const statCards = [
    { label: 'Total Balance', value: data?.totalBalance || 0, icon: Wallet, color: 'bg-blue-50 text-blue-600' },
    { label: 'Monthly Income', value: data?.monthlyIncome || 0, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Monthly Expenses', value: data?.monthlyExpenses || 0, icon: TrendingDown, color: 'bg-red-50 text-red-600' },
    { label: 'Active Goals', value: data?.activeGoals || 0, icon: Target, color: 'bg-purple-50 text-purple-600', isCount: true },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-24 mb-4" />
              <div className="h-8 bg-gray-100 rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Your financial overview at a glance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="card-hover">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{card.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {card.isCount ? card.value : formatCurrency(card.value)}
                      </p>
                    </div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${card.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.expenseByCategory?.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.expenseByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {data.expenseByCategory.map((_: any, index: number) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {data.expenseByCategory.slice(0, 6).map((cat: any, i: number) => (
                    <div key={cat.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-gray-600 flex-1">{cat.name}</span>
                      <span className="font-medium">{formatCurrency(cat.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
                No expenses recorded this month
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.monthlyTrends || []} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB' }}
                />
                <Legend />
                <Bar name="Income" dataKey="income" fill="#10B981" radius={[6, 6, 0, 0]} />
                <Bar name="Expenses" dataKey="expenses" fill="#EF4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a href="/transactions" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Plus className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900">Add Transaction</p>
                <p className="text-xs text-gray-500">Record income or expense</p>
              </div>
            </a>
            <a href="/ai" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900">Ask AI</p>
                <p className="text-xs text-gray-500">Get financial advice</p>
              </div>
            </a>
            <a href="/budget" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <PiggyBank className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900">Create Budget</p>
                <p className="text-xs text-gray-500">Plan your spending</p>
              </div>
            </a>
            <a href="/reports" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <Download className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900">Export Report</p>
                <p className="text-xs text-gray-500">Download financial report</p>
              </div>
            </a>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <a href="/transactions" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              View all →
            </a>
          </CardHeader>
          <CardContent>
            {data?.recentTransactions?.length > 0 ? (
              <div className="space-y-3">
                {data.recentTransactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: getCategoryColor(tx.category) + '15' }}>
                      {getCategoryIcon(tx.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{tx.category}</p>
                      <p className="text-xs text-gray-500">{formatDate(tx.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold text-sm ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">No transactions yet</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
