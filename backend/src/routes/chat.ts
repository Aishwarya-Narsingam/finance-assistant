import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { chatSchema } from '../utils/validators';
import { AuthRequest, FinancialSummary } from '../types';
import { generateChatResponse, checkHealth, testApiKey } from '../services/groq';
import { buildFinancialSummary, formatSummaryForPrompt, formatScopedSummary } from '../services/financialContextBuilder';
import { detectIntent } from '../services/intentDetection';
import { detectResponseMode } from '../services/responseMode';
import { buildQuickPrompt, buildDetailedPrompt, buildDetailedReportPrompt, getMaxTokens, getTemperature } from '../services/promptTemplates';

const router = Router();

// ─── POST /chat — Send a message ─────────────────────────────
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { message } = chatSchema.parse(req.body);

  // Save user message
  await prisma.chatHistory.create({
    data: { role: 'user', content: message, userId },
  });

  // ─── Detect intent and response mode ────────────────────────
  const { intent, category } = detectIntent(message);
  const mode = detectResponseMode(message);

  console.log(`[Chat] Intent: ${intent}, Mode: ${mode}, Category: ${category || 'none'}`);

  // ─── Build financial context ────────────────────────────────
  const financialSummary = await buildFinancialSummary(userId, message);

  // Build the appropriate prompt based on mode and intent
  let prompt: string;
  let maxTokens: number;
  let temperature: number;

  if (mode === 'DETAILED') {
    // For "report" keyword specifically, use the report template
    if (message.toLowerCase().includes('monthly report') || message.toLowerCase().includes('financial report')) {
      const contextString = formatSummaryForPrompt(financialSummary);
      prompt = buildDetailedReportPrompt(contextString);
    } else {
      const contextString = formatSummaryForPrompt(financialSummary);
      prompt = buildDetailedPrompt(intent, contextString);
    }
    maxTokens = getMaxTokens(mode);
    temperature = getTemperature(mode);
  } else {
    // Quick mode — use scoped context to minimize tokens
    const contextString = formatScopedSummary(financialSummary, intent);
    prompt = buildQuickPrompt(intent, contextString, category);
    maxTokens = getMaxTokens(mode);
    temperature = getTemperature(mode);
  }

  let response: string;

  try {
    console.log(`[Chat] Sending to AI — tokens: ${maxTokens}, temp: ${temperature}`);
    response = await generateChatResponse(prompt, '', maxTokens, temperature);
  } catch {
    // Fallback: build a readable summary from actual data
    console.log('[Chat] AI unavailable — using fallback response');
    response = buildFallbackResponse(financialSummary);
  }

  // Save AI response
  await prisma.chatHistory.create({
    data: { role: 'assistant', content: response, userId },
  });

  res.json({ success: true, data: { response, mode, intent } });
}));

// ─── GET /chat/history ───────────────────────────────────────
router.get('/history', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const messages = await prisma.chatHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });
  res.json({ success: true, data: messages });
}));

// ─── DELETE /chat/history ────────────────────────────────────
router.delete('/history', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  await prisma.chatHistory.deleteMany({ where: { userId } });
  res.json({ success: true, message: 'Chat history cleared' });
}));

// ─── POST /chat/generate-budget ─────────────────────────────
router.post('/generate-budget', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const financialSummary = await buildFinancialSummary(userId);
  const contextString = formatSummaryForPrompt(financialSummary);

  const prompt = `Based on my financial data:\n\n${contextString}\n\nSuggest a personalized monthly budget using the 50/30/20 rule with specific category allocations.`;

  try {
    const suggestion = await generateChatResponse(prompt, '', 600, 0.3);
    res.json({ success: true, data: { suggestion } });
  } catch {
    res.json({
      success: true,
      data: {
        suggestion: buildFallbackResponse(financialSummary),
      },
    });
  }
}));

// ─── GET /chat/insights — Generate financial insights ───────
router.get('/insights', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const financialSummary = await buildFinancialSummary(userId);
  const contextString = formatSummaryForPrompt(financialSummary);

  const prompt = `Analyze my financial data:\n\n${contextString}\n\nProvide 3-5 actionable insights covering: spending patterns, savings rate evaluation, budget adherence, recommendations, and positive highlights.`;

  try {
    const insightsText = await generateChatResponse(prompt, '', 600, 0.3);

    // Save insight
    await prisma.financialInsight.create({
      data: {
        type: 'weekly_analysis',
        title: 'Financial Insights',
        content: insightsText,
        severity: financialSummary.overview.savingsRate >= 20 ? 'info'
          : financialSummary.overview.savingsRate >= 10 ? 'warning'
          : 'critical',
        userId,
      },
    });

    res.json({ success: true, data: { insights: insightsText } });
  } catch {
    res.json({
      success: true,
      data: {
        insights: buildFallbackResponse(financialSummary),
      },
    });
  }
}));

// ─── GET /chat/insights/history ──────────────────────────────
router.get('/insights/history', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const insights = await prisma.financialInsight.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json({ success: true, data: insights });
}));

// ─── GET /chat/health ─────────────────────────────────────────
router.get('/health', asyncHandler(async (_req, res: Response) => {
  const health = await checkHealth();
  res.json({ success: true, data: health });
}));

// ─── GET /chat/health/test-key ────────────────────────────────
router.get('/health/test-key', asyncHandler(async (_req, res: Response) => {
  const result = await testApiKey();
  res.json({ success: true, data: result });
}));

// ─── Fallback response builder (when AI is unavailable) ────
function buildFallbackResponse(summary: FinancialSummary): string {
  const { overview, period, budgets, goals, categoryBreakdown, categoryDetail } = summary;
  const lines: string[] = [];

  lines.push(`📊 **Financial Summary — ${period.month} ${period.year}**\n`);
  lines.push(`**Income:** ₹${overview.totalIncome.toLocaleString('en-IN')}`);
  lines.push(`**Expenses:** ₹${overview.totalExpenses.toLocaleString('en-IN')}`);
  lines.push(`**Balance:** ₹${overview.balance.toLocaleString('en-IN')}`);
  lines.push(`**Savings Rate:** ${overview.savingsRate}%\n`);

  if (overview.previousMonthBalance !== null) {
    const diff = overview.balance - overview.previousMonthBalance;
    if (diff >= 0) {
      lines.push(`✅ Your balance improved by ₹${Math.abs(Math.round(diff)).toLocaleString('en-IN')} compared to last month.\n`);
    } else {
      lines.push(`⚠️ Your balance dropped by ₹${Math.abs(Math.round(diff)).toLocaleString('en-IN')} compared to last month.\n`);
    }
  }

  // Budgets
  if (budgets.length > 0) {
    lines.push('**Budgets:**');
    budgets.forEach((b) => {
      const status = b.percentageUsed > 100 ? '🔴 Over budget' : b.percentageUsed > 80 ? '🟡 Nearly exhausted' : '🟢 On track';
      lines.push(`- ${b.name} (${b.category}): ₹${b.spent.toLocaleString('en-IN')} / ₹${b.budgeted.toLocaleString('en-IN')} (${b.percentageUsed}%) — ${status}`);
    });
    lines.push('');
  }

  // Category detail
  if (categoryDetail) {
    const cd = categoryDetail;
    lines.push(`**${cd.category} Analysis:**`);
    lines.push(`- Total spent: ₹${cd.totalSpent.toLocaleString('en-IN')}`);
    lines.push(`- Transactions: ${cd.transactionCount}`);
    lines.push(`- Avg expense: ₹${cd.averageExpense.toLocaleString('en-IN')}`);
    lines.push(`- % of total: ${cd.percentageOfTotal}%`);
    if (cd.previousMonth) {
      const change = cd.totalSpent - cd.previousMonth.totalSpent;
      const dir = change > 0 ? 'up' : 'down';
      lines.push(`- ${dir === 'up' ? '📈' : '📉'} ${dir === 'up' ? 'Increased' : 'Decreased'} by ₹${Math.abs(Math.round(change)).toLocaleString('en-IN')} from last month`);
    }
    lines.push('');
  }

  // Insights
  if (overview.totalExpenses > 0 || overview.totalIncome > 0) {
    lines.push('**Key Insights:**');
    if (overview.savingsRate >= 20) {
      lines.push('✅ Great savings rate! You\'re saving well above the recommended 20%.');
    } else if (overview.savingsRate >= 10) {
      lines.push('⚠️ Your savings rate is decent but could be improved. Aim for 20%.');
    } else if (overview.savingsRate > 0) {
      lines.push('❌ Your savings rate is low. Consider reducing discretionary spending.');
    } else {
      lines.push('❌ You\'re spending more than you earn. Review non-essential expenses.');
    }

    const overBudget = budgets.filter((b) => b.percentageUsed > 100);
    if (overBudget.length > 0) {
      lines.push(`🔴 You're over budget in ${overBudget.length} categor${overBudget.length > 1 ? 'ies' : 'y'}.`);
    }

    if (goals.length > 0) {
      const onTrack = goals.filter((g) => g.percentageComplete >= 50);
      if (onTrack.length > 0) {
        lines.push(`✅ ${onTrack.length} goal${onTrack.length > 1 ? 's' : ''} ${onTrack.length > 1 ? 'are' : 'is'} more than halfway complete!`);
      }
    }
  } else {
    lines.push('Start adding transactions to get personalized financial insights!');
  }

  return lines.join('\n');
}

export default router;
