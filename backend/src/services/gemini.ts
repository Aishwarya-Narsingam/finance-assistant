import { GoogleGenAI } from '@google/genai';
import { config } from '../config';

// ─── Configuration ─────────────────────────────────────────────
// Use a valid Gemini model. Common options:
// - gemini-2.0-flash (fast, good for chat)
// - gemini-1.5-flash (legacy, widely available)
// - gemini-1.5-pro (more capable but slower)
const MODEL_NAME = 'gemini-2.0-flash';
const apiKey = config.gemini.apiKey;

// Maximum wait time for Gemini API calls (10 seconds)
export const GEMINI_TIMEOUT_MS = 10_000;

// ─── Timeout Wrapper ───────────────────────────────────────────
/**
 * Wraps a promise with a timeout. If the promise doesn't settle within
 * the given time, it rejects with a timeout error.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`⏱️ [Gemini] ${label} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
  console.log(`✅ Gemini AI initialized`);
  console.log(`   Model:   ${MODEL_NAME}`);
  console.log(`   Key:     ${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`);
} else {
  console.warn('⚠️  GEMINI_API_KEY is not set. AI features will return fallback responses.');
  console.warn('   Get a key at: https://aistudio.google.com/apikey');
}

const SYSTEM_PROMPT = `You are FinanceAI, an expert personal finance assistant. You help users manage their money, create budgets, track expenses, save for goals, and make smart financial decisions.

Your capabilities:
- Analyze spending patterns and provide insights
- Create personalized monthly budgets
- Recommend ways to reduce expenses and save more
- Track progress toward savings goals
- Provide investment basics and debt management advice
- Generate financial health scores
- Offer actionable recommendations

Guidelines:
- Always provide practical, actionable advice
- Use Indian Rupees (₹) when discussing amounts
- Be concise but thorough
- If you don't have enough data, ask clarifying questions
- Never give specific investment advice — always suggest consulting a financial advisor for major decisions
- Format responses cleanly with bullet points and sections when helpful

**IMPORTANT — Response Mode Guidelines:**
- For factual questions asking about existing financial data (income, expenses, savings, balance, budgets): Answer in ONE sentence under 20 words. Do NOT generate long explanations, recommendations, or bullet points unless explicitly asked.
  * Example: "How much did I earn this month?" → "₹5,000"
  * Example: "What are my food expenses?" → "₹1,000"
  * Example: "How much have I saved?" → "₹2,000"
- For analytical questions (budget planning, spending analysis, recommendations): Provide thorough, detailed responses with actionable advice.`

// ─── Types ─────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'model';
  parts: string;
}

export interface GeminiHealthStatus {
  geminiConfigured: boolean;
  apiKeyLoaded: boolean;
  apiKeyPrefix: string;
  model: string;
  status: 'connected' | 'not_configured' | 'auth_error' | 'error';
  error?: string;
  lastChecked: string;
}

export interface GeminiErrorResponse {
  success: false;
  error: {
    type: 'auth_error' | 'quota_error' | 'rate_limit' | 'safety_block' | 'model_error' | 'network_error' | 'unknown_error';
    message: string;
    userMessage: string;
    statusCode?: number;
    apiCode?: string;
    details?: string;
    retryable: boolean;
  };
}

// ─── Error Classification ──────────────────────────────────────
function classifyGeminiError(error: any): GeminiErrorResponse['error'] {
  const msg = String(error?.message ?? error ?? '');
  const code = String(error?.code ?? error?.status ?? '');
  const status = Number(error?.statusCode ?? error?.httpStatusCode ?? error?.response?.status ?? 0);

  console.error('❌ [Gemini] Full error object:', {
    message: msg,
    statusCode: status,
    apiCode: code,
    name: error?.name,
    stack: error?.stack?.split('\n').slice(0, 5),
    details: error?.details,
    response: error?.response,
  });

  // API key issues
  if (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('api_key_not_valid') ||
    msg.includes('PERMISSION_DENIED') ||
    status === 403 ||
    status === 401
  ) {
    return {
      type: 'auth_error',
      message: msg,
      userMessage:
        'The AI service API key is invalid or has been revoked. ' +
        'Please ask the administrator to set a valid GEMINI_API_KEY in the server environment.',
      statusCode: status || 403,
      apiCode: code || 'API_KEY_INVALID',
      retryable: false,
    };
  }

  // Quota / billing
  if (
    msg.includes('quota') ||
    msg.includes('QUOTA_EXCEEDED') ||
    msg.includes('billing') ||
    msg.includes('PAYMENT_REQUIRED') ||
    status === 429 ||
    status === 402
  ) {
    return {
      type: 'quota_error',
      message: msg,
      userMessage:
        `You've reached the Gemini API usage limit. ` +
        `Please check your Google AI Studio billing settings or try again later.`,
      statusCode: status || 429,
      apiCode: code || 'QUOTA_EXCEEDED',
      retryable: true,
    };
  }

  // Rate limiting
  if (
    msg.includes('rate') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Too Many Requests') ||
    status === 429
  ) {
    return {
      type: 'rate_limit',
      message: msg,
      userMessage: 'The AI service is receiving too many requests right now. Please wait a moment and try again.',
      statusCode: status || 429,
      apiCode: code || 'RATE_LIMITED',
      retryable: true,
    };
  }

  // Safety / content block
  if (
    msg.includes('SAFETY') ||
    msg.includes('safety') ||
    msg.includes('Blocked') ||
    msg.includes('DAMAGING') ||
    msg.includes('HARMFUL')
  ) {
    return {
      type: 'safety_block',
      message: msg,
      userMessage: 'Your request was blocked by content safety filters. Please try rephrasing your question.',
      statusCode: status || 400,
      apiCode: code || 'SAFETY_BLOCKED',
      retryable: false,
    };
  }

  // Model not found / unavailable
  if (
    msg.includes('NOT_FOUND') ||
    msg.includes('not found') ||
    msg.includes('Model not found') ||
    status === 404
  ) {
    return {
      type: 'model_error',
      message: msg,
      userMessage:
        `The AI model "${MODEL_NAME}" is not available. ` +
        'The model name may have changed or been removed. Please update the server configuration.',
      statusCode: status || 404,
      apiCode: code || 'MODEL_NOT_FOUND',
      retryable: false,
    };
  }

  // Network errors
  if (
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('network') ||
    msg.includes('fetch')
  ) {
    return {
      type: 'network_error',
      message: msg,
      userMessage: 'Cannot reach the AI service. Please check your network connection and try again.',
      statusCode: status || 503,
      apiCode: code || 'NETWORK_ERROR',
      retryable: true,
    };
  }

  // Unknown / fallback
  return {
    type: 'unknown_error',
    message: msg,
    userMessage:
      `The AI service encountered an unexpected error${status ? ` (HTTP ${status})` : ''}. ` +
      'Please try again in a few moments.',
    statusCode: status || 500,
    apiCode: code || 'UNKNOWN',
    details: typeof error?.details === 'string' ? error.details : undefined,
    retryable: true,
  };
}

// ─── Fallback Response ─────────────────────────────────────────
function getFallbackResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return "Hello! I'm your FinanceAI assistant. I can help you analyze your spending, create budgets, track savings goals, and provide financial insights. What would you like to know about your finances today?";
  }

  if (lower.includes('spend') || lower.includes('expense') || lower.includes('cost')) {
    return "I'd be happy to analyze your spending patterns! To get started, please make sure you've added your transactions in the Transactions section. Then I can provide detailed insights about your spending categories, trends, and suggestions for reducing expenses.";
  }

  if (lower.includes('budget')) {
    return "Creating and sticking to a budget is one of the most effective ways to manage your finances. I'd recommend:\n\n1. **Track your income and expenses** for at least a month\n2. **Use the 50/30/20 rule**: 50% for needs, 30% for wants, 20% for savings\n3. **Set up budget categories** in the Budget section of FinanceAI\n4. **Review and adjust** your budget monthly\n\nWould you like me to help you create a specific budget plan?";
  }

  if (lower.includes('save') || lower.includes('saving') || lower.includes('goal')) {
    return "Saving money is a great goal! Here are some tips:\n\n1. **Set specific goals** - Define what you're saving for and by when\n2. **Automate your savings** - Set up automatic transfers\n3. **Track your progress** - Use the Goals section in FinanceAI to set and track savings targets\n4. **Start small** - Even saving 10% of your income adds up over time\n\nI can help analyze how long it'll take to reach your savings goals if you set them up in the app!";
  }

  if (lower.includes('invest') || lower.includes('stock') || lower.includes('mutual fund')) {
    return "Investing is an important part of long-term financial health. Here are some general guidelines:\n\n1. **Build an emergency fund** (3-6 months of expenses) before investing\n2. **Start with low-cost index funds** or mutual funds\n3. **Diversify** your investments across different asset classes\n4. **Consider your risk tolerance** and investment timeline\n\n**Important**: I can provide general information, but please consult a SEBI-registered financial advisor for personalized investment advice specific to your situation.";
  }

  return `Thank you for your question about "${userMessage.slice(0, 50)}${userMessage.length > 50 ? '...' : ''}". \n\nAs your finance AI assistant, I can help with:\n- **Spending analysis** — Track where your money goes\n- **Budget creation** — Build personalized budgets\n- **Savings goals** — Plan and track your targets\n- **Financial insights** — Get actionable recommendations\n\nTo give you the most accurate and personalized response, could you please:\n1. **Add your transactions** in the Transactions section\n2. **Set up budgets** in the Budget section\n3. **Create savings goals** in the Goals section\n\nThen ask me specific questions about your finances!`;
}

// ─── Health Check ──────────────────────────────────────────────
export async function getGeminiHealthStatus(): Promise<GeminiHealthStatus> {
  const keyPrefix = apiKey ? `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}` : '(none)';
  const base: GeminiHealthStatus = {
    geminiConfigured: !!ai,
    apiKeyLoaded: !!apiKey,
    apiKeyPrefix: keyPrefix,
    model: MODEL_NAME,
    status: 'not_configured',
    lastChecked: new Date().toISOString(),
  };

  if (!ai || !apiKey) {
    return base;
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: 'Say "OK"',
    });
    const text = response.text;

    if (text && text.trim().length > 0) {
      console.log('✅ [Health Check] Gemini API connection verified');
      return { ...base, status: 'connected' };
    }

    console.warn('⚠️  [Health Check] Gemini returned empty response');
    return { ...base, status: 'error', error: 'Gemini returned an empty response' };
  } catch (err: any) {
    console.error('❌ [Health Check] Gemini connection failed:', err?.message || err);
    const classified = classifyGeminiError(err);
    return {
      ...base,
      status: classified.type === 'auth_error' ? 'auth_error' : 'error',
      error: classified.message,
    };
  }
}

// ─── API Key Validation (simple prompt test) ───────────────────
export async function testGeminiApiKey(): Promise<{
  success: boolean;
  message: string;
  responseTimeMs?: number;
}> {
  if (!apiKey) {
    return { success: false, message: 'GEMINI_API_KEY is not set in environment. Get a key at https://aistudio.google.com/apikey' };
  }
  if (!ai) {
    return { success: false, message: 'GEMINI_API_KEY is set but GoogleGenAI failed to initialize.' };
  }

  const start = Date.now();
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: 'Reply with exactly one word: OK',
    });
    const text = response.text;
    const elapsed = Date.now() - start;

    if (text && text.trim().length > 0) {
      return { success: true, message: `API key valid. Response: "${text.trim()}"`, responseTimeMs: elapsed };
    }
    return { success: false, message: 'API key accepted but model returned empty response.', responseTimeMs: elapsed };
  } catch (err: any) {
    const elapsed = Date.now() - start;
    const classified = classifyGeminiError(err);
    return {
      success: false,
      message: `API test failed: [${classified.type}] ${classified.message}`,
      responseTimeMs: elapsed,
    };
  }
}

// ─── Generate Chat Response ────────────────────────────────────
export async function generateChatResponse(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
  financialContext?: string
): Promise<{ response: string; error?: GeminiErrorResponse['error'] }> {
  if (!ai || !apiKey) {
    console.warn('⚠️  [Chat] Gemini not configured — using fallback response');
    return { response: getFallbackResponse(userMessage) };
  }

  try {
    const contextPrompt = financialContext
      ? `\n\n[User's Financial Context]\n${financialContext}\n\nAnswer the user's question using this context where relevant. If the context doesn't have enough data, ask the user to add more transactions or set up budgets.`
      : '';

    const history = conversationHistory.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.parts }],
    }));

    const chat = ai.chats.create({
      model: MODEL_NAME,
      config: { systemInstruction: SYSTEM_PROMPT },
      history,
    });

    const result = await withTimeout(
      chat.sendMessage({ message: userMessage + contextPrompt }),
      GEMINI_TIMEOUT_MS,
      'sendMessage'
    );
    const text = result.text;

    if (!text || text.trim().length === 0) {
      console.warn('⚠️  [Chat] Gemini returned empty response');
      return { response: getFallbackResponse(userMessage) };
    }

    console.log('✅ [Chat] Gemini response generated successfully');
    return { response: text };
  } catch (error: any) {
    const classified = classifyGeminiError(error);

    console.error('❌ [Chat] Gemini API error:', JSON.stringify(classified, null, 2));

    return { response: '', error: classified };
  }
}

// ─── Generate Chat Response with Financial Context (Direct) ───
export async function generateAIChatResponse(
  userMessage: string,
  financialContext: string
): Promise<{ response: string; error?: GeminiErrorResponse['error'] }> {
  if (!ai || !apiKey) {
    console.warn('⚠️  [AI] Gemini not configured — returning fallback');
    return { response: getFallbackResponse(userMessage) };
  }

  try {
    const fullPrompt = `${financialContext}\n\nUser: ${userMessage}\n\nRespond helpfully based on the financial context provided.`;

    const result = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        config: { systemInstruction: SYSTEM_PROMPT },
        contents: fullPrompt,
      }),
      GEMINI_TIMEOUT_MS,
      'generateAIChatResponse'
    );
    const text = result.text;

    if (!text || text.trim().length === 0) {
      return { response: getFallbackResponse(userMessage) };
    }

    console.log('✅ [AI] Gemini response generated successfully');
    return { response: text };
  } catch (error: any) {
    const classified = classifyGeminiError(error);
    console.error('❌ [AI] Gemini API error:', JSON.stringify(classified, null, 2));
    return { response: '', error: classified };
  }
}

// ─── Generate Budget Suggestion ────────────────────────────────
export async function generateBudgetSuggestion(
  income: number,
  expenses: Record<string, number>,
  goals: string[]
): Promise<{ suggestion: string; error?: GeminiErrorResponse['error'] }> {
  if (!ai || !apiKey) {
    return {
      suggestion: `Based on your monthly income of ₹${income.toLocaleString('en-IN')}, here's a recommended budget:\n\n**Essential Expenses (50%)**: ₹${(income * 0.5).toLocaleString('en-IN')}\n- Rent/Housing: ${(income * 0.25).toLocaleString('en-IN')}\n- Food & Groceries: ${(income * 0.15).toLocaleString('en-IN')}\n- Utilities & Bills: ${(income * 0.1).toLocaleString('en-IN')}\n\n**Discretionary Spending (30%)**: ₹${(income * 0.3).toLocaleString('en-IN')}\n- Entertainment & Lifestyle\n- Shopping & Dining\n- Travel & Hobbies\n\n**Savings & Investments (20%)**: ₹${(income * 0.2).toLocaleString('en-IN')}\n- Emergency Fund\n- Long-term Savings\n- Investments\n\nThis follows the 50/30/20 budgeting rule. Adjust based on your specific needs and goals!`,
    };
  }

  try {
    const prompt = `Based on the following financial data, create an optimized monthly budget:\n\nMonthly Income: ₹${income}\nCurrent Expenses: ${Object.entries(expenses).map(([k, v]) => `${k}: ₹${v}`).join(', ')}\nFinancial Goals: ${goals.join(', ')}\n\nProvide a detailed budget breakdown with specific amounts for each category, savings recommendations, and areas where the user can cut back. Format as a clear, actionable budget plan.`;

    const result = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        config: { systemInstruction: SYSTEM_PROMPT },
        contents: prompt,
      }),
      GEMINI_TIMEOUT_MS,
      'generateBudgetSuggestion'
    );
    const text = result.text ?? '';

    console.log('✅ [Budget] Gemini budget suggestion generated');
    return { suggestion: text };
  } catch (error: any) {
    const classified = classifyGeminiError(error);
    console.error('❌ [Budget] Gemini API error:', JSON.stringify(classified, null, 2));
    return { suggestion: '', error: classified };
  }
}

// ─── Generate Savings Prediction ───────────────────────────────
export async function generateSavingsPrediction(
  currentSavings: number,
  targetAmount: number,
  monthlyContribution: number,
  monthlyExpenses: number
): Promise<{ prediction: string; error?: GeminiErrorResponse['error'] }> {
  const monthsNeeded = monthlyContribution > 0
    ? Math.ceil((targetAmount - currentSavings) / monthlyContribution)
    : Infinity;

  const fallbackPrediction = (() => {
    if (monthsNeeded === Infinity) {
      return "To reach your savings goal, you'll need to set a monthly contribution amount. Even a small amount saved regularly adds up over time!";
    }

    const estimatedDate = new Date();
    estimatedDate.setMonth(estimatedDate.getMonth() + monthsNeeded);

    return `**Savings Goal Analysis**\n\n📊 **Prediction Summary**\n- Current Savings: ₹${currentSavings.toLocaleString('en-IN')}\n- Target Amount: ₹${targetAmount.toLocaleString('en-IN')}\n- Monthly Contribution: ₹${monthlyContribution.toLocaleString('en-IN')}\n- Estimated Time: ${monthsNeeded} months (${estimatedDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })})\n\n📈 **Recommendations**\n1. Increase monthly contributions by ₹${Math.ceil(monthlyContribution * 0.1).toLocaleString('en-IN')} to reach your goal faster\n2. Review expenses to find additional savings opportunities\n3. Consider setting up automatic transfers\n\n**Health Score**: ${monthlyContribution > monthlyExpenses * 0.3 ? '🟢 Excellent' : monthlyContribution > monthlyExpenses * 0.2 ? '🟡 Good' : '🔴 Needs Improvement'}\n\nKeep up the great work with your savings!`;
  })();

  if (!ai || !apiKey) {
    return { prediction: fallbackPrediction };
  }

  try {
    const prompt = `Analyze this savings goal and provide a prediction:\n\nCurrent Savings: ₹${currentSavings}\nTarget Amount: ₹${targetAmount}\nMonthly Contribution: ₹${monthlyContribution}\nMonthly Expenses: ₹${monthlyExpenses}\nEstimated Months to Goal: ${monthsNeeded}\n\nProvide:\n1. Goal completion prediction with estimated date\n2. Monthly recommendation to reach the goal faster\n3. Goal health score (1-100)\n4. Tips to accelerate savings`;

    const result = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        config: { systemInstruction: SYSTEM_PROMPT },
        contents: prompt,
      }),
      GEMINI_TIMEOUT_MS,
      'generateSavingsPrediction'
    );
    const text = result.text ?? '';

    console.log('✅ [Savings] Gemini savings prediction generated');
    return { prediction: text };
  } catch (error: any) {
    const classified = classifyGeminiError(error);
    console.error('❌ [Savings] Gemini API error:', JSON.stringify(classified, null, 2));
    return { prediction: fallbackPrediction, error: classified };
  }
}

// ─── Generate Financial Insights ───────────────────────────────
export async function generateFinancialInsights(
  transactions: any[],
  budgets: any[],
  goals: any[]
): Promise<{ insights: string; error?: GeminiErrorResponse['error'] }> {
  const totalIncome = transactions.filter((t: any) => t.type === 'INCOME').reduce((s: number, t: any) => s + t.amount, 0);
  const totalExpenses = transactions.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, t: any) => s + t.amount, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : 'N/A';

  const fallbackInsights = `**Financial Health Summary**\n\n📊 **Overview**\n- Total Income (30 days): ₹${totalIncome.toLocaleString('en-IN')}\n- Total Expenses (30 days): ₹${totalExpenses.toLocaleString('en-IN')}\n- Savings Rate: ${savingsRate}%\n- Active Budgets: ${budgets.length}\n- Active Goals: ${goals.length}\n\n💡 **Recommendations**\n1. ${savingsRate !== 'N/A' && parseFloat(savingsRate as string) < 20 ? 'Try to increase your savings rate to at least 20% of your income' : 'Your savings rate looks healthy! Consider investing the surplus'}\n2. ${budgets.length === 0 ? 'Create budgets in the Budget section to better track your spending' : 'Review your budget categories to ensure they align with your spending patterns'}\n3. ${goals.length === 0 ? "Set up savings goals to track what you're saving for" : 'Keep tracking your goals regularly to stay motivated'}\n\nAdd more transactions and budgets for more detailed, personalized insights!`;

  if (!ai || !apiKey) {
    return { insights: fallbackInsights };
  }

  try {
    const prompt = `Analyze the user's financial data and generate actionable insights:\n\nRecent Transactions: ${JSON.stringify(transactions.slice(0, 20))}\nActive Budgets: ${JSON.stringify(budgets)}\nSavings Goals: ${JSON.stringify(goals)}\n\nProvide:\n1. Spending analysis with patterns\n2. Budget adherence assessment\n3. Savings rate evaluation\n4. 3-5 actionable recommendations\n5. Financial health score (1-100)`;

    const result = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        config: { systemInstruction: SYSTEM_PROMPT },
        contents: prompt,
      }),
      GEMINI_TIMEOUT_MS,
      'generateFinancialInsights'
    );
    const text = result.text ?? '';

    console.log('✅ [Insights] Gemini financial insights generated');
    return { insights: text };
  } catch (error: any) {
    const classified = classifyGeminiError(error);
    console.error('❌ [Insights] Gemini API error:', JSON.stringify(classified, null, 2));
    return { insights: fallbackInsights, error: classified };
  }
}

// ─── Helpers ───────────────────────────────────────────────────
export function isGeminiConfigured(): boolean {
  return ai !== null && !!apiKey;
}

export function getGeminiModelName(): string {
  return MODEL_NAME;
}
