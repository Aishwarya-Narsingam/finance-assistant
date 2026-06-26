import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    FOOD: "bg-orange-100 text-orange-700",
    TRAVEL: "bg-blue-100 text-blue-700",
    SHOPPING: "bg-pink-100 text-pink-700",
    BILLS: "bg-red-100 text-red-700",
    RENT: "bg-purple-100 text-purple-700",
    INVESTMENT: "bg-green-100 text-green-700",
    ENTERTAINMENT: "bg-yellow-100 text-yellow-700",
    HEALTHCARE: "bg-teal-100 text-teal-700",
    EDUCATION: "bg-indigo-100 text-indigo-700",
    SALARY: "bg-emerald-100 text-emerald-700",
    FREELANCE: "bg-cyan-100 text-cyan-700",
    OTHER: "bg-gray-100 text-gray-700",
  };
  return colors[category] || colors.OTHER;
}

export function getCategoryDotColor(category: string): string {
  const colors: Record<string, string> = {
    FOOD: "bg-orange-500",
    TRAVEL: "bg-blue-500",
    SHOPPING: "bg-pink-500",
    BILLS: "bg-red-500",
    RENT: "bg-purple-500",
    INVESTMENT: "bg-green-500",
    ENTERTAINMENT: "bg-yellow-500",
    HEALTHCARE: "bg-teal-500",
    EDUCATION: "bg-indigo-500",
    SALARY: "bg-emerald-500",
    FREELANCE: "bg-cyan-500",
    OTHER: "bg-gray-500",
  };
  return colors[category] || colors.OTHER;
}

export function getChartColor(index: number): string {
  const colors = [
    "#6366f1",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#ec4899",
    "#14b8a6",
    "#f97316",
    "#3b82f6",
  ];
  return colors[index % colors.length];
}
