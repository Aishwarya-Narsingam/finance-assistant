"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/utils";
import { motion } from "framer-motion";
import { Shield, Users, Search, Trash2, ChevronLeft, ChevronRight, Activity } from "lucide-react";

export default function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"dashboard" | "users" | "audit">("dashboard");
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");

  const { data: dashboardData, isLoading: dashLoading } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => adminApi.dashboard(),
    enabled: tab === "dashboard",
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["admin", "users", userPage, userSearch],
    queryFn: () => adminApi.users({ page: userPage, limit: 20, search: userSearch || undefined }),
    enabled: tab === "users",
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => adminApi.auditLogs(),
    enabled: tab === "audit",
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const dash = (dashboardData?.data as any)?.data;
  const users = (usersData?.data as any)?.data || [];
  const userPagination = (usersData?.data as any)?.pagination;
  const audits = (auditData?.data as any)?.data || [];

  if (user?.role !== "ADMIN") {
    return (
      <Card>
        <CardContent className="py-12 text-center text-red-600">
          <Shield className="mx-auto mb-4 h-12 w-12" />
          <p>Admin access required.</p>
        </CardContent>
      </Card>
    );
  }

  const tabs = [
    { id: "dashboard" as const, label: "Dashboard", icon: Activity },
    { id: "users" as const, label: "Users", icon: Users },
    { id: "audit" as const, label: "Audit Logs", icon: Search },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <div className="flex gap-1 rounded-lg border p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard" && (
        <>
          {dashLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : dash ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">{dash.totalUsers}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">Active This Month</p>
                    <p className="text-2xl font-bold">{dash.activeUsersThisMonth}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">Total Transactions</p>
                    <p className="text-2xl font-bold">{dash.totalTransactions?.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">AI Messages (Month)</p>
                    <p className="text-2xl font-bold">{dash.aiMessagesThisMonth?.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>

              {dash.recentLogs?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dash.recentLogs.map((log: any) => (
                        <div key={log.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                          <div>
                            <span className="font-medium">{log.action}</span>
                            <span className="text-muted-foreground"> by {log.user?.name || "Unknown"}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </>
      )}

      {tab === "users" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : (
              <div className="divide-y">
                {users.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={u.role === "ADMIN" ? "destructive" : "secondary"}>{u.role}</Badge>
                      <span className="text-xs text-muted-foreground">{u._count?.transactions || 0} txns</span>
                      {u.role !== "ADMIN" && (
                        <button
                          onClick={() => { if (confirm("Delete this user?")) deleteUserMutation.mutate(u.id); }}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {userPagination?.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPage === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">Page {userPagination.page} of {userPagination.totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setUserPage(p => Math.min(userPagination.totalPages, p + 1))} disabled={userPage === userPagination.totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "audit" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Audit Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <Skeleton className="h-48 rounded-lg" />
            ) : audits.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No audit logs yet.</div>
            ) : (
              <div className="space-y-2">
                {audits.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <span className="font-medium">{log.action}</span>
                      <span className="text-muted-foreground"> on {log.entity}</span>
                      {log.user && <span className="text-muted-foreground"> by {log.user.name}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
