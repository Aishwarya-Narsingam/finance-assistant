import type { IntentType } from './intentDetection';
import type { ResponseMode } from './responseMode';

// ─── Helper: build the system prompt with accuracy rules ─────

function systemPrompt(): string {
  return `You are FinanceAI, an intelligent personal finance assistant.

CORE RULES (strict):
- NEVER calculate income, expenses, savings, percentages, averages, or transaction counts yourself. The numbers in the financial data below are pre-calculated and accurate. Only explain them.
- Never give generic advice. Always reference the user's actual numbers from the data provided.
- Format amounts in ₹ INR (e.g., ₹1,500, ₹10,000).
- Keep responses professional, minimal, and actionable.
- Use Markdown formatting.
- Use emojis only for headings/line prefixes — never in the middle of sentences.`;
}

// ─── Quick Mode Prompt Builders (max 80 words, 3–6 lines) ─────

function quickSummaryPrompt(data: string): string {
  return `${systemPrompt()}

RESPONSE FORMAT (strict):
📊 Summary
• Show 2–3 key numbers only

💡 Insight
• One short sentence

✅ Recommendation
• One actionable suggestion

MAXIMUM 80 words. 3–6 lines total.

Financial data:
${data}`;
}

function quickCategoryPrompt(category: string, data: string): string {
  return `${systemPrompt()}

RESPONSE FORMAT (strict):
🍔 {Category} Expenses   (use appropriate emoji)
• Total: ₹{amount}
• Share: {percentage}%
• Transactions: {count}

💡 One short insight sentence.

✅ One actionable recommendation.

MAXIMUM 80 words. 3–6 lines total.

Financial data for ${category}:
${data}`;
}

function quickBudgetPrompt(data: string): string {
  return `${systemPrompt()}

RESPONSE FORMAT (strict):
📊 Budget Check
• Budget name: ₹{spent} / ₹{budget} ({percentage}%)

💡 One short insight about budget health.

✅ One actionable suggestion.

MAXIMUM 80 words. 3–6 lines total.

Financial data:
${data}`;
}

function quickGoalsPrompt(data: string): string {
  return `${systemPrompt()}

RESPONSE FORMAT (strict):
🎯 Goal Name
• ₹{current} / ₹{target} ({progress}%)

💡 One short insight about progress.

✅ One actionable suggestion.

MAXIMUM 80 words. 3–6 lines total.

Financial data:
${data}`;
}

function quickSavingsPrompt(data: string): string {
  return `${systemPrompt()}

RESPONSE FORMAT (strict):
💰 Savings Overview
• Savings Rate: {rate}%
• Total Saved: ₹{amount}

💡 One short insight about savings.

✅ One actionable suggestion to save more.

MAXIMUM 80 words. 3–6 lines total.

Financial data:
${data}`;
}

function quickGreetingPrompt(data: string): string {
  return `${systemPrompt()}

You are responding to a greeting from the user.

RESPONSE FORMAT (strict):
👋 Welcome back!

• Briefly greet the user.
• Tell them their current balance in one line using the data below.
• Ask one question to start a conversation (e.g., "Want to check your budget?").

MAXIMUM 4 lines.

Financial data:
${data}`;
}

// ─── Detailed Mode Prompt Builders (max 300 words) ───────────

function detailedReportPrompt(data: string): string {
  return `${systemPrompt()}

RESPONSE FORMAT (strict — max 300 words):

📊 Monthly Financial Report — {Month} {Year}

**Income Analysis**
• Total income
• Income sources if available
• Trend vs last month

**Expense Analysis**
• Total expenses
• Top spending categories
• Largest expense
• Trend vs last month

**Category Breakdown**
• All categories with amounts and percentages
• Comparisons with last month

**Budget Performance**
• How each budget is tracking
• Over/under budget items

**Savings Analysis**
• Savings rate
• Total saved
• How it compares to the 20% target

**Goal Tracking**
• Progress on active goals
• Expected completion

**Financial Health Score**
• Score out of 100 based on savings rate, budget adherence, and goal progress
• One-line verdict

**Recommendations**
• 2–3 actionable steps

Financial data:
${data}`;
}

function detailedAnalysisPrompt(intent: IntentType, data: string): string {
  const sections = getAnalysisSections(intent);

  return `${systemPrompt()}

RESPONSE FORMAT (strict — max 300 words):

Provide a detailed analysis with the following sections:

${sections.map((s) => `**${s}**`).join('\n')}

Base everything on this financial data:
${data}

Never calculate numbers yourself — use only the data provided.`;
}

function getAnalysisSections(intent: IntentType): string[] {
  switch (intent) {
    case 'CATEGORY_ANALYSIS':
      return ['Spending Breakdown', 'Month-over-Month Comparison', 'Budget Impact', 'Optimization Suggestions'];
    case 'BUDGET':
      return ['Budget Performance', 'Category Allocation', 'Overspend Alerts', 'Suggested Adjustments'];
    case 'GOALS':
      return ['Progress Report', 'Projected Completion', 'Risk Assessment', 'Acceleration Tips'];
    case 'INCOME':
      return ['Income Sources', 'Month-over-Month Trend', 'Reliability Assessment', 'Growth Suggestions'];
    case 'EXPENSES':
      return ['Expense Breakdown', 'Category Deep Dive', 'Trend Analysis', 'Reduction Opportunities'];
    case 'SAVINGS':
      return ['Savings Rate Analysis', 'Goal Alignment', 'Optimization Opportunities', 'Automation Suggestions'];
    case 'TRANSACTIONS':
      return ['Recent Activity', 'Spending Patterns', 'Unusual Items', 'Categorization Review'];
    case 'REPORTS':
      return ['Executive Summary', 'Income vs Expenses', 'Budget Health', 'Recommendations'];
    case 'RECOMMENDATIONS':
      return ['Top Recommendations', 'Expected Impact', 'Difficulty Level', 'Priority Order'];
    default:
      return ['Overview', 'Key Insights', 'Recommendations'];
  }
}

// ─── Public API ──────────────────────────────────────────────

export function buildQuickPrompt(intent: IntentType, financialData: string, category?: string | null): string {
  switch (intent) {
    case 'CATEGORY_ANALYSIS':
      return quickCategoryPrompt(category || 'Spending', financialData);
    case 'BUDGET':
      return quickBudgetPrompt(financialData);
    case 'GOALS':
      return quickGoalsPrompt(financialData);
    case 'SAVINGS':
      return quickSavingsPrompt(financialData);
    case 'GREETING':
      return quickGreetingPrompt(financialData);
    default:
      return quickSummaryPrompt(financialData);
  }
}

export function buildDetailedPrompt(intent: IntentType, financialData: string): string {
  if (intent === 'GREETING') {
    return quickGreetingPrompt(financialData); // Greetings are always quick
  }
  return detailedAnalysisPrompt(intent, financialData);
}

export function buildDetailedReportPrompt(financialData: string): string {
  return detailedReportPrompt(financialData);
}

/** Get max tokens based on mode */
export function getMaxTokens(mode: ResponseMode): number {
  return mode === 'QUICK' ? 200 : 600;
}

/** Get temperature based on mode */
export function getTemperature(mode: ResponseMode): number {
  return mode === 'QUICK' ? 0.2 : 0.3;
}
