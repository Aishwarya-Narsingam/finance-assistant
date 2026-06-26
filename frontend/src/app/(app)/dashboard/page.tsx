"use client";

import { useQuery } from "@tanstack/react-query";
import { transactionsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, getCategoryDotColor } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ArrowLeftRight,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#3b82f6"];

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => transactionsApi.summary(),
    refetchInterval: 60000,
  });

  const summary = (data?.data as any)?.data;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-600">
          Failed to load dashboard data. Please try again.
        </CardContent>
      </Card>
    );
  }

  const statsCards = [
    {
      title: "Total Balance",
      value: summary.totalBalance,
      icon: Wallet,
      color: "text-indigo-600",
      bg: "bg-indigo-100",
      trend: summary.savingsRate >= 0 ? "up" : "down",
    },
    {
      title: "Total Income",
      value: summary.totalIncome,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-100",
      trend: "up",
    },
    {
      title: "Total Expenses",
      value: summary.totalExpenses,
      icon: TrendingDown,
      color: "text-red-600",
      bg: "bg-red-100",
      trend: "down",
    },
    {
      title: "Savings Rate",
      value: summary.savingsRate,
      icon: PiggyBank,
      color: "text-purple-600",
      bg: "bg-purple-100",
      isPercentage: true,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/transactions">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`rounded-lg ${stat.bg} p-2`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  {stat.trend === "up" && <ArrowUpRight className="h-4 w-4 text-green-500" />}
                  {stat.trend === "down" && <ArrowDownRight className="h-4 w-4 text-red-500" />}
                </div>
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">
                    {stat.isPercentage
                      ? `${stat.value.toFixed(1)}%`
                      : formatCurrency(stat.value)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Monthly trends */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.incomeTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), undefined]}
                  />
                  <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="amount"
                    nameKey="category"
                  >
                    {summary.categoryBreakdown.map((_: any, index: number) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), undefined]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {summary.categoryBreakdown.slice(0, 6).map((item: any, index: number) => (
                <div key={item.category} className="flex items-center gap-2 text-sm">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index] }} />
                  <span className="flex-1 truncate">{item.category}</span>
                  <span className="font-medium">{item.percentage.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
          <Link href="/transactions">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {summary.recentTransactions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No transactions yet. Start by adding your first transaction.
            </div>
          ) : (
            <div className="space-y-3">
              {summary.recentTransactions.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${getCategoryDotColor(t.category)}`} />
                    <div>
                      <p className="text-sm font-medium">{t.description || t.category}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${t.type === "INCOME" ? "text-green-600" : "text-red-600"}`}>
                    {t.type === "INCOME" ? "+" : "-"}{formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
