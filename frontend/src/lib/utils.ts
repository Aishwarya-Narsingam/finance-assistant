import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    FOOD: '#F59E0B',
    TRAVEL: '#8B5CF6',
    SHOPPING: '#EC4899',
    BILLS: '#6366F1',
    RENT: '#64748B',
    INVESTMENT: '#14B8A6',
    ENTERTAINMENT: '#F43F5E',
    HEALTHCARE: '#10B981',
    EDUCATION: '#3B82F6',
    SALARY: '#22C55E',
    FREELANCE: '#A855F7',
    OTHER: '#9CA3AF',
  };
  return colors[category] || '#9CA3AF';
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    FOOD: '🍔',
    TRAVEL: '✈️',
    SHOPPING: '🛍️',
    BILLS: '📄',
    RENT: '🏠',
    INVESTMENT: '📈',
    ENTERTAINMENT: '🎬',
    HEALTHCARE: '🏥',
    EDUCATION: '📚',
    SALARY: '💰',
    FREELANCE: '💻',
    OTHER: '📋',
  };
  return icons[category] || '📋';
}
