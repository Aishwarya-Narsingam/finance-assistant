"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { goalsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";
import { Plus, Target, PiggyBank, TrendingUp, Sparkles, Loader2, Trash2 } from "lucide-react";

export default function GoalsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fundDialog, setFundDialog] = useState<{ open: boolean; goalId: string; goalName: string }>({ open: false, goalId: "", goalName: "" });
  const [predictDialog, setPredictDialog] = useState<{ open: boolean; prediction: string }>({ open: false, prediction: "" });
  const [form, setForm] = useState({
    name: "",
    targetAmount: "",
    deadline: "",
    monthlyTarget: "",
    priority: "MEDIUM",
  });
  const [fundAmount, setFundAmount] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: () => goalsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => goalsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setDialogOpen(false);
      setForm({ name: "", targetAmount: "", deadline: "", monthlyTarget: "", priority: "MEDIUM" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => goalsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });

  const addFundsMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => goalsApi.addFunds(id, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setFundDialog({ open: false, goalId: "", goalName: "" });
      setFundAmount("");
    },
  });

  const goals = (data?.data as any)?.data || [];

  async function handlePredict(goalId: string) {
    try {
      const res = await goalsApi.predict(goalId);
      setPredictDialog({ open: true, prediction: res.data.data.prediction });
    } catch {
      setPredictDialog({ open: true, prediction: "Unable to generate prediction at this time." });
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Savings Goals</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setForm({ name: "", targetAmount: "", deadline: "", monthlyTarget: "", priority: "MEDIUM" }); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Savings Goal</DialogTitle>
              <DialogDescription>Set a new financial goal to work towards.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...form, targetAmount: parseFloat(form.targetAmount), monthlyTarget: form.monthlyTarget ? parseFloat(form.monthlyTarget) : undefined, deadline: form.deadline || undefined }); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Goal Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Emergency Fund" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Amount (₹)</Label>
                  <Input type="number" step="0.01" min="0" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Deadline (optional)</Label>
                  <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Target (optional)</Label>
                  <Input type="number" step="0.01" min="0" value={form.monthlyTarget} onChange={(e) => setForm({ ...form, monthlyTarget: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Goal
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Target className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <p>No savings goals yet. Create your first goal to start tracking progress.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal: any, index: number) => (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className={goal.status === "COMPLETED" ? "border-green-200 bg-green-50/50" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{goal.name}</CardTitle>
                      <CardDescription>
                        {goal.status === "COMPLETED" ? "Completed! 🎉" : `${goal.progress.toFixed(1)}% complete`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={goal.priority === "HIGH" ? "destructive" : goal.priority === "MEDIUM" ? "warning" : "secondary"}>
                        {goal.priority}
                      </Badge>
                      {goal.status === "COMPLETED" && <Badge variant="success">Done</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}</span>
                    </div>
                    <Progress value={Math.min(goal.progress, 100)} className={goal.progress >= 100 ? "bg-green-100" : ""} />
                  </div>

                  <div className="flex items-center justify-between text-sm mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${goal.healthScore >= 70 ? "bg-green-500" : goal.healthScore >= 40 ? "bg-yellow-500" : "bg-red-500"}`} />
                      <span>Health Score: {goal.healthScore}/100</span>
                    </div>
                    {goal.deadline && (
                      <span className="text-muted-foreground">Due {new Date(goal.deadline).toLocaleDateString()}</span>
                    )}
                  </div>

                  {goal.status !== "COMPLETED" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => setFundDialog({ open: true, goalId: goal.id, goalName: goal.name })}
                      >
                        <PiggyBank className="h-3.5 w-3.5" />
                        Add Funds
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => handlePredict(goal.id)}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Predict
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-red-500 hover:text-red-600"
                        onClick={() => { if (confirm("Delete this goal?")) deleteMutation.mutate(goal.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Funds Dialog */}
      <Dialog open={fundDialog.open} onOpenChange={(open) => setFundDialog({ ...fundDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Funds</DialogTitle>
            <DialogDescription>Add funds to {fundDialog.goalName}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); addFundsMutation.mutate({ id: fundDialog.goalId, amount: parseFloat(fundAmount) }); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input type="number" step="0.01" min="0" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={addFundsMutation.isPending}>
                {addFundsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Prediction Dialog */}
      <Dialog open={predictDialog.open} onOpenChange={(open) => setPredictDialog({ ...predictDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              AI Prediction
            </DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm text-muted-foreground">
            {predictDialog.prediction}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
