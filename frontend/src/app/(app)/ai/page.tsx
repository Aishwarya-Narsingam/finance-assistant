"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Sparkles, Trash2, Loader2 } from "lucide-react";

interface Message {
  id?: string;
  role: string;
  content: string;
  createdAt?: string;
}

export default function AiChatPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["chat-history"],
    queryFn: () => chatApi.history(),
  });

  const historyMessages: Message[] = historyData?.data?.data || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, historyMessages]);

  const sendMutation = useMutation({
    mutationFn: (msg: string) => chatApi.send(msg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-history"] });
      setIsSending(false);
    },
    onError: () => {
      setIsSending(false);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => chatApi.clearHistory(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-history"] });
      setLocalMessages([]);
    },
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSending) return;

    const userMsg: Message = { role: "user", content: message };
    setLocalMessages((prev) => [...prev, userMsg]);
    setIsSending(true);
    setMessage("");
    sendMutation.mutate(message);
  };

  const allMessages = [...historyMessages, ...localMessages].filter(
    (msg, index, self) => index === self.findIndex((m) => m.content === msg.content && m.role === msg.role)
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">Ask anything about your finances</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={async () => {
              const res = await chatApi.insights();
              const insights = res.data.data.insights;
              setLocalMessages((prev) => [...prev, { role: "user", content: "Show me my financial insights" }, { role: "assistant", content: insights }]);
            }}
          >
            <Sparkles className="h-4 w-4" />
            Insights
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-red-500 hover:text-red-600"
            onClick={() => clearMutation.mutate()}
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Chat messages */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="h-full overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className={`h-20 rounded-lg ${i % 2 === 0 ? "w-3/4" : "w-1/2"}`} />
                </div>
              ))}
            </div>
          ) : allMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <Bot className="mb-4 h-12 w-12 text-indigo-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">Ask me anything!</h3>
              <p className="max-w-md text-sm">
                I can help you analyze your spending, suggest budgets, track your goals,
                and answer questions about your finances.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2">
                {[
                  "How much did I spend this month?",
                  "Create a budget for me",
                  "Show my savings goals progress",
                  "Analyze my spending patterns",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    className="rounded-lg border p-2 text-left text-xs hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setLocalMessages((prev) => [...prev, { role: "user", content: suggestion }]);
                      setIsSending(true);
                      sendMutation.mutate(suggestion);
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <AnimatePresence>
              {allMessages.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-3 mb-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${msg.role === "user" ? "bg-indigo-100" : "bg-purple-100"}`}>
                    {msg.role === "user" ? (
                      <User className="h-4 w-4 text-indigo-600" />
                    ) : (
                      <Bot className="h-4 w-4 text-purple-600" />
                    )}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </motion.div>
              ))}
              {isSending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3 mb-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                    <Bot className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="rounded-lg bg-gray-100 px-4 py-2">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
      </Card>

      {/* Input */}
      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask about your finances..."
          className="flex-1"
          disabled={isSending}
        />
        <Button type="submit" disabled={!message.trim() || isSending}>
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </motion.div>
  );
}
