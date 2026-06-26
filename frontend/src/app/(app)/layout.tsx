"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Target,
  Bot,
  FileText,
  Bell,
  Settings,
  Shield,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { label: "Budget", href: "/budget", icon: Wallet },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "AI Assistant", href: "/ai", icon: Bot },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Admin", href: "/admin", icon: Shield, adminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: notifData } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => notificationsApi.list({ read: "false" }),
    refetchInterval: 30000,
    enabled: !!user,
  });

  const unreadCount = (notifData?.data?.data as any)?.unreadCount || 0;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-white transition-all duration-300 lg:static ${
          sidebarOpen ? "w-64" : "w-16"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {sidebarOpen ? (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                F
              </div>
              <span className="font-bold">FinanceAI</span>
            </Link>
          ) : (
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              F
            </div>
          )}
          <button
            onClick={() => {
              setSidebarOpen(!sidebarOpen);
              setMobileOpen(false);
            }}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 lg:block hidden"
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            if (item.adminOnly && user.role !== "ADMIN") return null;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
                title={sidebarOpen ? undefined : item.label}
              >
                <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-indigo-600" : "text-gray-400"}`} />
                {sidebarOpen && (
                  <>
                    <span>{item.label}</span>
                    {item.href === "/notifications" && unreadCount > 0 && (
                      <Badge className="ml-auto bg-indigo-600 text-white text-xs px-1.5 py-0.5">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Badge>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        {sidebarOpen && (
          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.avatar || undefined} />
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white px-4 lg:px-6">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          <Link
            href="/notifications"
            className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>

          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
