"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { budgetsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency, getCategoryDotColor } from "@/lib/utils";
import { motion } from "framer-motion";
import { Plus, Wallet, Trash2, Loader2, Sparkles } from "lucide-react";

const CATEGORIES = ["FOOD", "TRAVEL", "SHOPPING", "BILLS", "RENT", "INVESTMENT", "ENTERTAINMENT", "HEALTHCARE", "EDUCATION", "SALARY", "FREELANCE", "OTHER"];

export default function BudgetPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState("");
  const [form, setForm] = useState({
    name: "",
    amount: "",
    category: "FOOD",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => budgetsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => budgetsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      setDialogOpen(false);
      setForm({ name: "", amount: "", category: "FOOD", month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => budgetsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  });

  const budgets = (data?.data as any)?.data || [];

  async function generateAiBudget() {
    setAiDialogOpen(true);
    setAiSuggestions("");
    try {
      const res = await chatApi.generateBudget();
      setAiSuggestions(res.data.data.suggestion);
    } catch {
      setAiSuggestions("Failed to generate AI suggestions. Please try again.");
    }
  }

  const totalBudgeted = budgets.reduce((sum: number, b: any) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum: number, b: any) => sum + b.spent, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budget</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={generateAiBudget}>
            <Sparkles className="h-4 w-4" />
            AI Suggestions
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Budget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Budget</DialogTitle>
                <DialogDescription>Set a monthly budget for a category.</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...form, amount: parseFloat(form.amount) }); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Budget Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Monthly Groceries" required />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Budget
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Budgeted</p>
            <p className="text-2xl font-bold">{formatCurrency(totalBudgeted)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Spent</p>
            <p className={`text-2xl font-bold ${totalSpent > totalBudgeted ? "text-red-600" : "text-green-600"}`}>{formatCurrency(totalSpent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Remaining</p>
            <p className="text-2xl font-bold">{formatCurrency(Math.max(0, totalBudgeted - totalSpent))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget list */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wallet className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <p>No budgets set. Create your first budget to start tracking.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {budgets.map((budget: any, index: number) => (
            <motion.div
              key={budget.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${getCategoryDotColor(budget.category)}`} />
                      <div>
                        <p className="font-medium">{budget.name}</p>
                        <p className="text-xs text-muted-foreground">{budget.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}</p>
                        <p className="text-xs text-muted-foreground">{budget.spentPercentage.toFixed(1)}% used</p>
                      </div>
                      <button onClick={() => deleteMutation.mutate(budget.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <Progress value={Math.min(budget.spentPercentage, 100)} className={budget.isOverBudget ? "bg-red-100" : ""} />
                  <div className="mt-1 flex justify-between text-xs">
                    {budget.isOverBudget ? (
                      <Badge variant="destructive" className="text-xs">Over Budget!</Badge>
                    ) : budget.spentPercentage >= 80 ? (
                      <Badge variant="warning" className="text-xs">Almost Reached</Badge>
                    ) : <span />}
                    <span className="text-muted-foreground">{formatCurrency(budget.remaining)} remaining</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* AI Suggestions Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              AI Budget Suggestions
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
            {aiSuggestions || <Loader2 className="h-6 w-6 animate-spin" />}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
