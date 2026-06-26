"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { transactionsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate, getCategoryColor } from "@/lib/utils";
import { motion } from "framer-motion";
import { Plus, Search, Trash2, Edit, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const CATEGORIES = ["FOOD", "TRAVEL", "SHOPPING", "BILLS", "RENT", "INVESTMENT", "ENTERTAINMENT", "HEALTHCARE", "EDUCATION", "SALARY", "FREELANCE", "OTHER"];

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    amount: "",
    type: "EXPENSE",
    category: "OTHER",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", page, search, typeFilter, categoryFilter],
    queryFn: () => transactionsApi.list({ page, limit: 20, search, type: typeFilter || undefined, category: categoryFilter || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => transactionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => transactionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const transactions = (data?.data as any)?.data || [];
  const pagination = (data?.data as any)?.pagination || { page: 1, total: 0, totalPages: 0 };

  function resetForm() {
    setForm({ amount: "", type: "EXPENSE", category: "OTHER", description: "", date: new Date().toISOString().split("T")[0] });
    setEditing(null);
  }

  function openEdit(t: any) {
    setEditing(t);
    setForm({
      amount: String(t.amount),
      type: t.type,
      category: t.category,
      description: t.description || "",
      date: new Date(t.date).toISOString().split("T")[0],
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, amount: parseFloat(form.amount), date: new Date(form.date).toISOString() };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
              <DialogDescription>Enter the transaction details below.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={form.type === "INCOME" ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, type: "INCOME" })} className="flex-1">Income</Button>
                    <Button type="button" variant={form.type === "EXPENSE" ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, type: "EXPENSE" })} className="flex-1">Expense</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <div className="grid grid-cols-3 gap-1">
                  {CATEGORIES.map((cat) => (
                    <button key={cat} type="button" onClick={() => setForm({ ...form, category: cat })} className={`rounded px-2 py-1 text-xs font-medium transition-colors ${form.category === cat ? "bg-indigo-100 text-indigo-700" : "hover:bg-gray-100"}`}>{cat}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input className="pl-9" placeholder="Search transactions..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select className="rounded-lg border px-3 py-2 text-sm" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
            <select className="rounded-lg border px-3 py-2 text-sm" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
              <option value="">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No transactions found. Add your first transaction to get started.
            </div>
          ) : (
            <div className="divide-y">
              {transactions.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${t.type === "INCOME" ? "bg-green-500" : "bg-red-500"}`} />
                    <div>
                      <p className="text-sm font-medium">{t.description || t.category}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={getCategoryColor(t.category)}>{t.category}</span>
                        <span>{formatDate(t.date)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${t.type === "INCOME" ? "text-green-600" : "text-red-600"}`}>
                      {t.type === "INCOME" ? "+" : "-"}{formatCurrency(t.amount)}
                    </span>
                    <button onClick={() => openEdit(t)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => { if (confirm("Delete this transaction?")) deleteMutation.mutate(t.id); }} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}
