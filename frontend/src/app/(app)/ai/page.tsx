'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { chatApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { getInitials } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Sparkles,
  Trash2,
  Loader2,
  Bot,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Lightbulb,
  ShieldAlert,
  Clock,
  WifiOff,
} from 'lucide-react';
import Image from 'next/image';

// ─── Types ─────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

interface ChatError {
  type: string;
  message: string;
  retryable: boolean;
  statusCode?: number;
}

// ─── Suggested Prompts ─────────────────────────────────────────
const SUGGESTIONS = [
  'How much did I spend this month?',
  'Analyze my savings',
  'Show highest expense category',
  'Give budgeting tips',
  "Predict next month's spending",
];

// ─── Error Icon Helper ─────────────────────────────────────────
function ErrorIcon({ type }: { type: string }) {
  switch (type) {
    case 'auth_error':
      return <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />;
    case 'rate_limit':
    case 'quota_error':
      return <Clock className="h-4 w-4 text-amber-600 shrink-0" />;
    case 'network_error':
      return <WifiOff className="h-4 w-4 text-orange-600 shrink-0" />;
    default:
      return <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />;
  }
}

// ─── Markdown Renderer (simple) ────────────────────────────────
function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold mt-3 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold mt-4 mb-2">{line.slice(3)}</h2>;
        if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;

        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;

        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} className="flex items-start gap-2 pl-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }

        const numberedMatch = line.match(/^(\d+)\.\s(.+)/);
        if (numberedMatch) {
          return (
            <div key={i} className="flex items-start gap-2 pl-2">
              <span className="text-gray-400 font-medium min-w-[1.5rem]">{numberedMatch[1]}.</span>
              <span>{numberedMatch[2]}</span>
            </div>
          );
        }

        if (!line.trim()) return <div key={i} className="h-2" />;

        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

// ─── Typing Indicator ──────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center shrink-0">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="bg-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2">
        <div className="flex gap-1">
          <motion.span
            className="w-2 h-2 bg-gray-400 rounded-full"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
          />
          <motion.span
            className="w-2 h-2 bg-gray-400 rounded-full"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
          />
          <motion.span
            className="w-2 h-2 bg-gray-400 rounded-full"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
          />
        </div>
        <span className="text-sm text-gray-500 ml-1">Thinking...</span>
      </div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────
function EmptyState({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-50 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
        <Sparkles className="h-10 w-10 text-gray-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">How can I help you today?</h3>
      <p className="text-gray-500 text-sm mb-8 max-w-md">
        I&apos;m your AI financial assistant. Ask me about your spending, budgets, savings goals, or get personalized financial advice.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSend(s)}
            className="text-left p-3.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all duration-200 active:scale-[0.98]"
          >
            <Lightbulb className="h-3.5 w-3.5 inline mr-1.5 text-gray-400" />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main AI Chat Page ─────────────────────────────────────────
export default function AIChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<ChatError | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Fetch chat history ──────────────────────────────────
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await chatApi.history();
        setMessages(data.messages || []);
      } catch {
        // ignore
      }
    };
    fetchHistory();
  }, []);

  // ─── Auto-scroll ─────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, loading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ─── Send message ────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setError(null);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await chatApi.send(text);

      // Always show the response (even on AI failure, backend returns a response)
      const responseText = data.response || 'I received your message.';

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'model',
        content: responseText,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Show a subtle notification if AI was unavailable but data was shown
      if (data.success === false && data.message) {
        setError({
          type: 'service_unavailable',
          message: data.message,
          retryable: true,
        });
      } else if (data.aiAvailable === false) {
        // AI was unavailable but we showed fallback data — show a brief notice
        setError({
          type: 'service_unavailable',
          message: 'AI analysis is temporarily unavailable. Showing available financial data.',
          retryable: true,
        });
      }
    } catch (err: any) {
      // Handle axios errors (network failures, HTTP errors, etc.)
      const responseData = err.response?.data;
      const statusCode = err.response?.status;

      // Backend always returns 200 now, so this only happens for network errors
      if (!err.response) {
        // Network error — can't reach backend
        const chatError: ChatError = {
          type: 'network_error',
          message: 'Unable to connect to the server. Please check your connection.',
          retryable: true,
        };
        setError(chatError);

        const errMsg: Message = {
          id: `ai-${Date.now()}`,
          role: 'model',
          content: 'AI analysis is temporarily unavailable. Here is your available financial data...',
        };
        setMessages((prev) => [...prev, errMsg]);
      } else if (statusCode === 429) {
        const chatError: ChatError = {
          type: 'rate_limit',
          message: "You're sending messages too quickly. Please wait a moment and try again.",
          retryable: true,
          statusCode: 429,
        };
        setError(chatError);

        const errMsg: Message = {
          id: `ai-${Date.now()}`,
          role: 'model',
          content: "Please wait a moment before sending another message.",
        };
        setMessages((prev) => [...prev, errMsg]);
      } else if (responseData?.response) {
        // Backend returned an error response with a fallback message
        const errMsg: Message = {
          id: `ai-${Date.now()}`,
          role: 'model',
          content: responseData.response,
        };
        setMessages((prev) => [...prev, errMsg]);
      } else {
        // Generic fallback — never show "Sorry, I encountered an error"
        const errMsg: Message = {
          id: `ai-${Date.now()}`,
          role: 'model',
          content: 'AI analysis is temporarily unavailable. Please try again in a few moments.',
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // ─── Copy message ────────────────────────────────────────
  const copyMessage = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  // ─── Regenerate last AI response ───────────────────────
  const regenerateLast = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      setMessages((prev) => prev.slice(0, -1));
      sendMessage(lastUserMsg.content);
    }
  };

  // ─── Clear history ──────────────────────────────────────
  const clearHistory = async () => {
    try {
      await chatApi.clearHistory();
    } catch {
      // ignore
    }
    setMessages([]);
    setError(null);
  };

  // ─── Handle form submit ─────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // ─── Handle key down ────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const lastMsgIsAI = messages.length > 0 && messages[messages.length - 1]?.role === 'model';

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6" /> AI Assistant
          </h1>
          <p className="text-gray-500 text-sm">Your personal AI-powered financial advisor</p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearHistory}
              className="text-gray-500"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className={`flex items-start gap-2 p-3 rounded-xl border ${
              error.type === 'auth_error'
                ? 'bg-red-50 border-red-100'
                : error.type === 'rate_limit' || error.type === 'quota_error'
                ? 'bg-amber-50 border-amber-100'
                : error.type === 'network_error'
                ? 'bg-orange-50 border-orange-100'
                : 'bg-amber-50 border-amber-100'
            }`}>
              <ErrorIcon type={error.type} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${
                  error.type === 'auth_error' ? 'text-red-700' : 'text-amber-700'
                }`}>
                  {error.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
                <p className={`text-xs mt-0.5 ${
                  error.type === 'auth_error' ? 'text-red-600' : 'text-amber-600'
                }`}>
                  {error.message}
                </p>
                {error.statusCode && (
                  <p className="text-xs text-gray-400 mt-1">HTTP {error.statusCode}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className={`${error.type === 'auth_error' ? 'text-red-600 hover:text-red-700 hover:bg-red-100' : 'text-amber-600 hover:text-amber-700 hover:bg-amber-100'}`}
              >
                Dismiss
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border-gray-200">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 scroll-smooth"
        >
          {messages.length === 0 ? (
            <EmptyState onSend={sendMessage} />
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* AI Avatar */}
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`group relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-gray-900 text-white rounded-tr-md'
                      : 'bg-gray-50 text-gray-900 border border-gray-100 rounded-tl-md'
                  }`}>
                    {msg.role === 'model' ? (
                      <SimpleMarkdown content={msg.content} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {/* Message Actions */}
                    <div className={`absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ${
                      msg.role === 'user' ? 'left-0 -translate-x-full -ml-2' : 'right-0 translate-x-full mr-2'
                    }`}>
                      <button
                        onClick={() => copyMessage(msg.content, msg.id)}
                        className="p-1.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* User Avatar */}
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1 overflow-hidden bg-gray-200">
                      {user?.image || user?.avatar ? (
                        <Image src={user.image || user.avatar!} alt="You" width={32} height={32} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-medium text-gray-600">{getInitials(user?.name || '')}</span>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {/* Loading Indicator */}
          {loading && <TypingIndicator />}

          {/* Bottom spacer */}
          <div className="h-2" />
        </div>

        {/* Regenerate Button */}
        {lastMsgIsAI && !loading && (
          <div className="flex justify-center pb-2">
            <button
              onClick={regenerateLast}
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="h-3 w-3" /> Regenerate response
            </button>
          </div>
        )}
      </Card>

      {/* Input Area */}
      <div className="mt-3">
        <form
          onSubmit={handleSubmit}
          className="flex gap-2"
        >
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances..."
              className="flex-1 pr-12 h-12 bg-white border-gray-200 focus:border-gray-300"
              disabled={loading}
              autoComplete="off"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-5 w-5 text-gray-300 animate-spin" />
              </div>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={!input.trim() || loading}
            className="h-12 w-12 p-0"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
        <p className="text-xs text-gray-400 mt-2 text-center">
          FinanceAI can make mistakes. Verify important financial decisions with a professional advisor.
        </p>
      </div>
    </div>
  );
}
