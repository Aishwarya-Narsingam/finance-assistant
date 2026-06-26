"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reportsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { motion } from "framer-motion";
import { FileText, Plus, Trash2, Loader2, Eye } from "lucide-react";

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewReport, setViewReport] = useState<any>(null);
  const [form, setForm] = useState({
    type: "MONTHLY",
    startDate: "",
    endDate: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => reportsApi.list(),
  });

  const generateMutation = useMutation({
    mutationFn: (data: any) => reportsApi.generate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reports"] }),
  });

  const reports = (data?.data as any)?.data || [];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Generate Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Report</DialogTitle>
              <DialogDescription>Choose a report type and date range.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); generateMutation.mutate(form); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Report Type</Label>
                <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                  <option value="CUSTOM">Custom Range</option>
                </select>
              </div>
              {form.type === "CUSTOM" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <input type="date" className="w-full rounded-lg border px-3 py-2 text-sm" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <input type="date" className="w-full rounded-lg border px-3 py-2 text-sm" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button type="submit" disabled={generateMutation.isPending}>
                  {generateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <p>No reports generated yet. Generate your first report to see your financial health.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reports.map((report: any) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg capitalize">{report.type.toLowerCase()} Report</CardTitle>
                      <CardDescription>
                        {formatDate(report.startDate)} - {formatDate(report.endDate)}
                      </CardDescription>
                    </div>
                    <Badge variant={report.data?.healthScore >= 70 ? "success" : report.data?.healthScore >= 40 ? "warning" : "destructive"}>
                      Score: {report.data?.healthScore || "N/A"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Income: ₹{(report.data?.summary?.totalIncome || 0).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                      Expenses: ₹{(report.data?.summary?.totalExpenses || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setViewReport(report)}>
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1 text-red-500" onClick={() => { if (confirm("Delete this report?")) deleteMutation.mutate(report.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* View Report Dialog */}
      <Dialog open={!!viewReport} onOpenChange={(open) => { if (!open) setViewReport(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
          </DialogHeader>
          {viewReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-green-50 p-4 text-center">
                  <p className="text-sm text-muted-foreground">Income</p>
                  <p className="text-xl font-bold text-green-600">₹{(viewReport.data?.summary?.totalIncome || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-4 text-center">
                  <p className="text-sm text-muted-foreground">Expenses</p>
                  <p className="text-xl font-bold text-red-600">₹{(viewReport.data?.summary?.totalExpenses || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-4 text-center">
                  <p className="text-sm text-muted-foreground">Net Savings</p>
                  <p className="text-xl font-bold text-blue-600">₹{(viewReport.data?.summary?.netSavings || 0).toLocaleString()}</p>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Category Breakdown</h3>
                <div className="space-y-2">
                  {Object.entries(viewReport.data?.categoryBreakdown || {}).map(([cat, amount]) => (
                    <div key={cat} className="flex justify-between rounded-lg border px-3 py-2 text-sm">
                      <span>{cat}</span>
                      <span className="font-medium">₹{(amount as number).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
