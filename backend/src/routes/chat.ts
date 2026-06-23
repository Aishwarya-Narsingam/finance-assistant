import { Router, Response } from 'express';
import prisma from '../config/prisma';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { chatMessageSchema } from '../utils/validators';
import {
  generateAIChatResponse,
  generateBudgetSuggestion,
  generateFinancialInsights,
  getGeminiHealthStatus,
  testGeminiApiKey,
} from '../services/gemini';
import { asyncHandler } from '../utils/asyncHandler';
import { detectIntent, INTENT_LABELS, FinanceIntent, isDirectQueryIntent, isAIIntent } from '../services/intentDetection';
import {
  getIncomeThisMonth,
  getExpensesThisMonth,
  getFoodExpenses,
  getCurrentSavings,
  getRemainingBudget,
  getBudgetStatus,
  getSavingsGoalProgress,
  getRecentTransactions,
  getBalance,
  getCategorySpending,
  getSpendingAnalysis,
  buildFinancialContext,
  formatQuickResponse,
} from '../services/financeQuery';

const router = Router();

// =====================================================================
// HEALTH & DIAGNOSTIC ENDPOINTS
// =====================================================================

// ─── AI Health Check (no auth required) ────────────────────────
router.get('/health', asyncHandler(async (_req, res) => {
  const start = Date.now();
  const geminiStatus = await getGeminiHealthStatus();

  // Check database connectivity
  let databaseConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseConnected = true;
  } catch {
    databaseConnected = false;
  }

  const healthy = geminiStatus.status === 'connected' && databaseConnected;
  const elapsed = Date.now() - start;

  console.log(`🏥 [Health] Check completed in ${elapsed}ms | healthy=${healthy}`);

  res.json({
    geminiConfigured: geminiStatus.geminiConfigured,
    apiKeyLoaded: geminiStatus.apiKeyLoaded,
    databaseConnected,
    status: healthy ? 'healthy' : 'degraded',
    gemini: geminiStatus.status,
    responseTimeMs: elapsed,
  });
}));

// ─── API Key Test ──────────────────────────────────────────────
router.get('/health/test-key', asyncHandler(async (_req, res) => {
  const result = await testGeminiApiKey();
  res.json({ ...result, success: result.success });
}));

// =====================================================================
// CHAT MESSAGE ENDPOINT
// =====================================================================

// ─── Send Chat Message ─────────────────────────────────────────
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const overallStart = Date.now();

  // ── Validate input ──────────────────────────────────────────
  let body;
  try {
    body = chatMessageSchema.parse(req.body);
  } catch (validationError) {
    console.warn('⚠️ [Chat] Validation failed:', validationError);
    res.json({
      response: 'Please provide a valid message.',
      mode: 'quick',
      intent: 'general_chat',
      success: false,
      responseTimeMs: Date.now() - overallStart,
    });
    return;
  }

  const userId = req.user!.id;

  // ── Step 1: Detect Intent ────────────────────────────────
  const intent = detectIntent(body.message);
  console.log(`🔍 [Chat] Intent detected: ${INTENT_LABELS[intent]} (${intent})`);
  console.log(`📝 [Chat] User query: "${body.message.slice(0, 100)}"`);

  // ── Step 2: Save user message to history (always) ────────────
  try {
    await prisma.chatHistory.create({
      data: { role: 'user', content: body.message, userId },
    });
  } catch (historyErr) {
    console.error('❌ [Chat] Failed to save user message to history:', historyErr);
  }

  // ── Step 3: Route based on intent type ───────────────────────
  const intentRoute = isDirectQueryIntent(intent) ? 'Database' : isAIIntent(intent) ? 'Gemini' : 'Unknown';
  console.log(`🛣️  [Chat] Route selected: ${intentRoute}`);

  try {
    if (isDirectQueryIntent(intent)) {
      await handleDirectQueryRoute(intent, userId, body.message, res, overallStart);
    } else if (isAIIntent(intent)) {
      await handleAIRoute(intent, userId, body.message, res, overallStart);
    } else {
      // Fallback: treat as general chat
      await handleAIRoute('general_chat', userId, body.message, res, overallStart);
    }
  } catch (unexpectedError: unknown) {
    // ── Global catch-all: never crash ───────────────────────────
    const elapsed = Date.now() - overallStart;
    console.error('💥 [Chat] Unexpected error:', unexpectedError instanceof Error ? unexpectedError.message : unexpectedError);

    res.json({
      response: 'AI analysis is temporarily unavailable. Here is your available financial data...',
      mode: 'quick',
      intent,
      success: false,
      message: 'AI service unavailable',
      responseTimeMs: elapsed,
    });
  }
}));

// ─── Direct Database Query Route ───────────────────────────────
async function handleDirectQueryRoute(
  intent: FinanceIntent,
  userId: string,
  originalMessage: string,
  res: Response,
  overallStart: number
) {
  const startTime = Date.now();

  try {
    let responseText: string;

    switch (intent) {
      case 'income': {
        const value = await getIncomeThisMonth(userId);
        responseText = formatQuickResponse('income', value);
        break;
      }

      case 'expenses': {
        const value = await getExpensesThisMonth(userId);
        responseText = formatQuickResponse('expenses', value);
        break;
      }

      case 'food_expenses': {
        const value = await getFoodExpenses(userId);
        responseText = formatQuickResponse('food_expenses', value);
        break;
      }

      case 'category_spending': {
        const category = extractCategory(originalMessage);
        const value = category
          ? await getCategorySpending(userId, category)
          : await getExpensesThisMonth(userId);
        responseText = formatQuickResponse('category_spending', value, { category: category || 'all' });
        break;
      }

      case 'savings': {
        const value = await getCurrentSavings(userId);
        responseText = formatQuickResponse('savings', value);
        break;
      }

      case 'balance': {
        const value = await getBalance(userId);
        responseText = formatQuickResponse('balance', value);
        break;
      }

      case 'budget_status': {
        const budgetInfo = await getRemainingBudget(userId);
        if (budgetInfo.totalBudget === 0) {
          responseText = 'No budgets set up for this month. Would you like me to create one for you?';
        } else {
          responseText = formatQuickResponse('budget_status', budgetInfo.remaining, {
            remaining: budgetInfo.remaining,
            totalBudget: budgetInfo.totalBudget,
          });
        }
        break;
      }

      case 'goals': {
        const goals = await getSavingsGoalProgress(userId);
        if (goals.length === 0) {
          responseText = 'No active savings goals found.';
        } else {
          const sorted = [...goals].sort((a, b) => a.progress - b.progress);
          const goalList = sorted
            .map(
              (g) =>
                `${g.name}: ₹${g.currentAmount.toLocaleString('en-IN')} / ₹${g.targetAmount.toLocaleString('en-IN')} (${g.progress}%)`
            )
            .join(', ');
          responseText = goalList;
        }
        break;
      }

      case 'goal_progress': {
        const goals = await getSavingsGoalProgress(userId);
        if (goals.length === 0) {
          responseText = 'No active savings goals found. Set one up to start tracking your progress!';
        } else {
          const details = goals.map((g) => {
            const remaining = g.targetAmount - g.currentAmount;
            return `${g.name}: ${g.progress}% complete (₹${g.currentAmount.toLocaleString('en-IN')} saved of ₹${g.targetAmount.toLocaleString('en-IN')}, ₹${remaining.toLocaleString('en-IN')} remaining)`;
          }).join('\n');
          responseText = details;
        }
        break;
      }

      case 'recent_transactions': {
        const transactions = await getRecentTransactions(userId, 5);
        if (transactions.length === 0) {
          responseText = 'No transactions yet.';
        } else {
          const lines = transactions.map(
            (t) =>
              `${t.date.toLocaleDateString('en-IN')} - ${t.category}: ₹${t.amount.toLocaleString('en-IN')} (${t.type})${t.description ? ` - ${t.description}` : ''}`
          );
          responseText = lines.join('\n');
        }
        break;
      }

      default:
        responseText = "I'm not sure how to answer that with your data. Try asking about your income, expenses, or budgets!";
    }

    const elapsed = Date.now() - startTime;
    const overallElapsed = Date.now() - overallStart;

    console.log(`⚡ [Chat] Database query responded in ${elapsed}ms (total: ${overallElapsed}ms)`);

    // Save response to history
    try {
      await prisma.chatHistory.create({
        data: { role: 'model', content: responseText, userId },
      });
    } catch (historyErr) {
      console.error('❌ [Chat] Failed to save AI response to history:', historyErr);
    }

    res.json({
      response: responseText,
      mode: 'quick',
      intent,
      success: true,
      responseTimeMs: elapsed,
    });
  } catch (dbError: unknown) {
    const elapsed = Date.now() - overallStart;
    console.error('❌ [Chat] Database query failed:', dbError instanceof Error ? dbError.message : dbError);

    res.json({
      response: 'Unable to access financial records right now.',
      mode: 'quick',
      intent,
      success: false,
      message: 'Unable to access financial records right now.',
      responseTimeMs: elapsed,
    });
  }
}

// ─── AI Analysis Route (Gemini) ────────────────────────────────
async function handleAIRoute(
  intent: FinanceIntent,
  userId: string,
  userMessage: string,
  res: Response,
  overallStart: number
) {
  const startTime = Date.now();

  try {
    // ── Build financial context for AI ────────────────────────
    console.log(`📊 [Chat] Building financial context for AI...`);
    const financialContext = await buildFinancialContext(userId);

    // ── Generate AI response with context ────────────────────
    console.log(`🤖 [Chat] Sending to Gemini (intent: ${INTENT_LABELS[intent]})...`);

    // For budget creation, we need the special prompt
    let result;
    if (intent === 'budget_creation') {
      // Get detailed spending data
      const [income, spending, budgets, goals] = await Promise.all([
        getIncomeThisMonth(userId),
        getSpendingAnalysis(userId),
        getBudgetStatus(userId),
        getSavingsGoalProgress(userId),
      ]);

      const detailedContext = `${financialContext}\n\n[Detailed Budget Info]\n${JSON.stringify({ income, categoryBreakdown: spending.categoryBreakdown, currentBudgets: budgets, savingsGoals: goals }, null, 2)}`;

      result = await generateAIChatResponse(
        `Create a personalized monthly budget for me. ${userMessage}`,
        detailedContext
      );
    } else {
      result = await generateAIChatResponse(userMessage, financialContext);
    }

    const aiElapsed = Date.now() - startTime;
    console.log(`🤖 [Chat] Gemini responded in ${aiElapsed}ms`);

    // ── Handle AI errors gracefully ───────────────────────────
    if (result.error) {
      console.error('❌ [Chat] Gemini error:', result.error.type, result.error.message);

      // For AI analysis failures, try to provide fallback data
      const fallbackResponse = await getFallbackForIntent(intent, userId);

      const responseText = fallbackResponse ||
        'AI analysis is temporarily unavailable. Here is your available financial data: ' + financialContext.slice(0, 200) + '...';

      // Save fallback response
      try {
        await prisma.chatHistory.create({
          data: { role: 'model', content: responseText, userId },
        });
      } catch {}

      const overallElapsed = Date.now() - overallStart;
      res.json({
        response: responseText,
        mode: 'detailed',
        intent,
        success: true,
        aiAvailable: false,
        message: 'AI analysis is temporarily unavailable. Showing available financial data.',
        responseTimeMs: overallElapsed,
      });
      return;
    }

    // ── Success: save and return ──────────────────────────────
    try {
      await prisma.chatHistory.create({
        data: { role: 'model', content: result.response, userId },
      });
    } catch {}

    const overallElapsed = Date.now() - overallStart;
    res.json({
      response: result.response,
      mode: 'detailed',
      intent,
      success: true,
      aiAvailable: true,
      responseTimeMs: overallElapsed,
    });
  } catch (error: unknown) {
    // ── Catch-all error handler ───────────────────────────────
    const elapsed = Date.now() - overallStart;
    console.error('❌ [Chat] AI route error:', error instanceof Error ? error.message : error);

    const errorResponse = 'AI analysis is temporarily unavailable. Please try again in a few moments.';

    try {
      await prisma.chatHistory.create({
        data: { role: 'model', content: errorResponse, userId },
      });
    } catch {}

    res.json({
      response: errorResponse,
      mode: 'detailed',
      intent,
      success: false,
      message: 'AI service unavailable',
      responseTimeMs: elapsed,
    });
  }
}

// ─── Fallback for AI intents when Gemini fails ─────────────────
async function getFallbackForIntent(intent: FinanceIntent, userId: string): Promise<string | null> {
  try {
    switch (intent) {
      case 'budget_creation': {
        const [income, expenses] = await Promise.all([
          getIncomeThisMonth(userId),
          getExpensesThisMonth(userId),
        ]);
        return `Based on your data, here's a recommended budget:\n\n**Income**: ₹${income.toLocaleString('en-IN')}\n**Expenses**: ₹${expenses.toLocaleString('en-IN')}\n\nTry the 50/30/20 rule:\n- **Needs (50%)**: ₹${(income * 0.5).toLocaleString('en-IN')}\n- **Wants (30%)**: ₹${(income * 0.3).toLocaleString('en-IN')}\n- **Savings (20%)**: ₹${(income * 0.2).toLocaleString('en-IN')}`;
      }
      case 'spending_analysis': {
        const analysis = await getSpendingAnalysis(userId);
        const topCategory = analysis.categoryBreakdown[0];
        return `**Spending Analysis**\n\nTotal Income: ₹${analysis.totalIncome.toLocaleString('en-IN')}\nTotal Expenses: ₹${analysis.totalExpenses.toLocaleString('en-IN')}\nSavings Rate: ${analysis.savingsRate}%\n${topCategory ? `Top Category: ${topCategory.category} (${topCategory.percentage}%)` : ''}\nDaily Average: ₹${analysis.dailyAverage.toLocaleString('en-IN')}`;
      }
      case 'savings_advice': {
        const [income, expenses, savings] = await Promise.all([
          getIncomeThisMonth(userId),
          getExpensesThisMonth(userId),
          getCurrentSavings(userId),
        ]);
        const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;
        return `**Savings Overview**\n\nCurrent Savings: ₹${savings.toLocaleString('en-IN')}\nMonthly Income: ₹${income.toLocaleString('en-IN')}\nMonthly Expenses: ₹${expenses.toLocaleString('en-IN')}\nSavings Rate: ${savingsRate}%\n\n${savingsRate < 20 ? 'Try to increase your savings rate to at least 20%. Consider reducing discretionary spending.' : 'Your savings rate looks healthy! Consider investing any surplus.'}`;
      }
      case 'financial_insights': {
        const analysis = await getSpendingAnalysis(userId);
        return `**Financial Health Summary**\n\nIncome: ₹${analysis.totalIncome.toLocaleString('en-IN')}\nExpenses: ₹${analysis.totalExpenses.toLocaleString('en-IN')}\nSavings Rate: ${analysis.savingsRate}%\nCategories: ${analysis.categoryBreakdown.length}\nTransactions: ${analysis.transactionCount}\n\nAdd more data for deeper insights!`;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ─── Category Extraction ──────────────────────────────────────
function extractCategory(message: string): string | null {
  const categoryMap: Record<string, string> = {
    food: 'FOOD',
    groceries: 'FOOD',
    eating: 'FOOD',
    restaurant: 'FOOD',
    travel: 'TRAVEL',
    transportation: 'TRAVEL',
    fuel: 'TRAVEL',
    petrol: 'TRAVEL',
    diesel: 'TRAVEL',
    shopping: 'SHOPPING',
    bills: 'BILLS',
    utilities: 'BILLS',
    electricity: 'BILLS',
    water: 'BILLS',
    internet: 'BILLS',
    phone: 'BILLS',
    rent: 'RENT',
    housing: 'RENT',
    investment: 'INVESTMENT',
    investing: 'INVESTMENT',
    stocks: 'INVESTMENT',
    entertainment: 'ENTERTAINMENT',
    fun: 'ENTERTAINMENT',
    movie: 'ENTERTAINMENT',
    healthcare: 'HEALTHCARE',
    health: 'HEALTHCARE',
    medical: 'HEALTHCARE',
    doctor: 'HEALTHCARE',
    education: 'EDUCATION',
    school: 'EDUCATION',
    course: 'EDUCATION',
    salary: 'SALARY',
    freelance: 'FREELANCE',
    other: 'OTHER',
  };

  const lower = message.toLowerCase();
  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (lower.includes(keyword)) {
      return category;
    }
  }
  return null;
}

// =====================================================================
// HISTORY ENDPOINTS
// =====================================================================

// ─── Get Chat History ──────────────────────────────────────────
router.get('/history', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const messages = await prisma.chatHistory.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  res.json({ messages });
}));

// ─── Clear Chat History ────────────────────────────────────────
router.delete('/history', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.chatHistory.deleteMany({ where: { userId: req.user!.id } });
  res.json({ message: 'Chat history cleared' });
}));

// =====================================================================
// LEGACY ENDPOINTS (keep for backward compatibility)
// =====================================================================

// ─── AI Budget Generator ───────────────────────────────────────
router.post('/generate-budget', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();

  try {
    const { income, expenses, goals } = req.body;

    // If user didn't provide data, get it from database
    const actualIncome = income || await getIncomeThisMonth(req.user!.id);
    const actualExpenses = expenses || {};
    const actualGoals = goals || [];

    const result = await generateBudgetSuggestion(
      actualIncome,
      actualExpenses,
      actualGoals
    );
    const elapsed = Date.now() - startTime;
    console.log(`⏱️ [Budget] Generated in ${elapsed}ms`);

    if (result.error) {
      res.json({
        suggestion: result.suggestion || 'AI analysis is temporarily unavailable.',
        success: false,
        message: 'AI service unavailable',
      });
      return;
    }

    res.json({ suggestion: result.suggestion, success: true });
  } catch (error: unknown) {
    console.error('❌ [Budget] Error:', error instanceof Error ? error.message : error);
    res.json({
      suggestion: 'Unable to generate budget right now.',
      success: false,
      message: 'AI service unavailable',
    });
  }
}));

// ─── AI Financial Insights ─────────────────────────────────────
router.get('/insights', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const overallStart = Date.now();

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [transactions, budgets, goals] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: req.user!.id, date: { gte: thirtyDaysAgo } },
        orderBy: { date: 'desc' },
      }),
      prisma.budget.findMany({
        where: { userId: req.user!.id, month: now.getMonth() + 1, year: now.getFullYear() },
      }),
      prisma.savingsGoal.findMany({
        where: { userId: req.user!.id, status: 'ACTIVE' },
      }),
    ]);

    const result = await generateFinancialInsights(transactions, budgets, goals);
    const elapsed = Date.now() - overallStart;
    console.log(`⏱️ [Insights] Generated in ${elapsed}ms`);

    // Save insight
    let savedInsight = null;
    try {
      savedInsight = await prisma.financialInsight.create({
        data: {
          type: 'WEEKLY_INSIGHT',
          title: 'Financial Insight',
          content: result.insights,
          userId: req.user!.id,
        },
      });
    } catch {}

    if (result.error) {
      res.json({
        insight: savedInsight,
        content: result.insights,
        success: false,
        message: 'AI analysis is temporarily unavailable. Showing basic financial data.',
      });
      return;
    }

    res.json({ insight: savedInsight, content: result.insights, success: true });
  } catch (error: unknown) {
    console.error('❌ [Insights] Error:', error instanceof Error ? error.message : error);
    res.json({
      content: 'Unable to generate financial insights right now.',
      success: false,
      message: 'AI service unavailable',
    });
  }
}));

// ─── Get Insights History ──────────────────────────────────────
router.get('/insights/history', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const insights = await prisma.financialInsight.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ insights });
  } catch (error: unknown) {
    console.error('❌ [Insights/History] Error:', error instanceof Error ? error.message : error);
    res.json({ insights: [] });
  }
}));

export default router;
