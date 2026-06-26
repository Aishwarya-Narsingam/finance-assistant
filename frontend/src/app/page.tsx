"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, TrendingUp, Target, Shield, BarChart3, MessageSquare } from "lucide-react";

const features = [
  {
    icon: TrendingUp,
    title: "Smart Dashboard",
    description: "Real-time financial overview with charts, trends, and actionable insights.",
    color: "bg-indigo-500",
  },
  {
    icon: MessageSquare,
    title: "AI Assistant",
    description: "Chat with AI to analyze spending, create budgets, and get financial advice.",
    color: "bg-purple-500",
  },
  {
    icon: Target,
    title: "Budget Generator",
    description: "AI-powered budgets based on the 50/30/20 rule and your spending patterns.",
    color: "bg-green-500",
  },
  {
    icon: Sparkles,
    title: "Savings Goals",
    description: "Set and track goals with AI predictions and health scores.",
    color: "bg-pink-500",
  },
  {
    icon: BarChart3,
    title: "Reports & Insights",
    description: "Generate weekly, monthly, or custom reports with financial health scores.",
    color: "bg-orange-500",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "JWT authentication, MFA support, and Google OAuth for maximum security.",
    color: "bg-blue-500",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              F
            </div>
            <span className="text-xl font-bold">FinanceAI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-white px-4 py-1.5 text-sm text-gray-600">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              AI-Powered Financial Assistant
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Take Control of Your
              <span className="block text-indigo-600">Financial Future</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
              FinanceAI combines the power of AI with smart financial tracking to help you budget better,
              save more, and achieve your financial goals.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                Get Started Free
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-16 grid grid-cols-2 gap-8 border-t pt-8 sm:grid-cols-4"
          >
            {[
              { label: "Active Users", value: "10,000+" },
              { label: "Transactions Tracked", value: "1M+" },
              { label: "AI Conversations", value: "50,000+" },
              { label: "Money Saved", value: "₹5Cr+" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Everything You Need to Manage Your Money
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              AI-powered tools to track, analyze, and optimize your finances.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group rounded-xl border bg-white p-6 hover:shadow-lg transition-shadow"
              >
                <div className={`mb-4 inline-flex rounded-lg ${feature.color} p-3 text-white`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-gradient-to-br from-indigo-600 to-purple-700 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to Transform Your Finances?
          </h2>
          <p className="mt-4 text-lg text-indigo-100">
            Join thousands of users who are taking control of their financial future with AI.
          </p>
          <Link
            href="/auth/register"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-medium text-indigo-600 hover:bg-indigo-50 transition-colors shadow-lg"
          >
            Get Started Free
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500 sm:px-6 lg:px-8">
          <p>© 2026 FinanceAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
