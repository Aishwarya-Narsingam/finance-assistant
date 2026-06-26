import Groq from "groq-sdk";
import { config } from "../config";
import { AppError } from "../middleware/error";

let groq: Groq | null = null;

const MODEL = "llama-3.3-70b-versatile";

function getClient(): Groq {
  if (!groq) {
    if (!config.groq.apiKey) {
      throw new AppError(503, "Groq API key not configured");
    }

    groq = new Groq({
      apiKey: config.groq.apiKey,
    });
  }

  return groq;
}

/**
 * Retry wrapper with exponential backoff (2s → 4s → 8s, max 3 retries).
 * Only retries on 503 (Service Unavailable) errors.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [2000, 4000, 8000];
  let lastError: any;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status =
        error.status || error.code || (error.message?.includes("503") ? 503 : 0);

      if (status === 503 && attempt < delays.length) {
        console.log(
          `⏳ Groq service unavailable, retrying in ${delays[attempt] / 1000}s... (attempt ${attempt + 1}/${delays.length})`
        );
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/**
 * Shared helper: sends a chat completion request to Groq.
 * All public AI functions route through this helper.
 */
async function askAI(prompt: string, maxTokens = 1000, temperature = 0.3): Promise<string> {
  console.log("✓ AI Request Started");

  try {
    const client = getClient();

    const completion = await withRetry(async () => {
      return await client.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature,
        max_tokens: maxTokens,
      });
    });

    const response =
      completion.choices[0]?.message?.content ??
      "Unable to generate response.";

    console.log("✓ AI Response Received");
    return response;
  } catch (error: any) {
    console.error("✗ AI Error:", error.message);
    throw classifyError(error);
  }
}

// ─── Public API ─────────────────────────────────────────────────

export async function checkHealth(): Promise<{
  configured: boolean;
  working: boolean;
  model: string;
}> {
  console.log("✓ Groq Connected");

  const healthy = {
    provider: "Groq",
    model: MODEL,
    configured: !!config.groq.apiKey,
    working: false,
  };

  if (!config.groq.apiKey) return healthy;

  try {
    const client = getClient();
    await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 5,
    });
    healthy.working = true;
  } catch {
    healthy.working = false;
  }

  return healthy;
}

export async function testApiKey(): Promise<{ valid: boolean; error?: string }> {
  try {
    const client = getClient();

    await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 5,
    });

    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

/**
 * Generate a natural-language chat response using a pre-built prompt.
 * The prompt already includes system instructions, financial context,
 * and the response format. This function just sends it to Groq.
 */
export async function generateChatResponse(
  prompt: string,
  _financialContext: string,
  maxTokens = 200,
  temperature = 0.2
): Promise<string> {
  return askAI(prompt, maxTokens, temperature);
}

/**
 * Generate a full budget suggestion using 50/30/20 rule.
 */
export async function generateBudgetSuggestion(
  context: string
): Promise<string> {
  const prompt = `You are FinanceAI, a personal finance assistant.

Based on the following financial data:

${context}

Generate a budget suggestion using the 50/30/20 rule:

1. Monthly Budget with category allocations
2. Spending Advice
3. Saving Suggestions
4. Investment Suggestions

Be specific and reference actual numbers. Max 300 words.`;

  return askAI(prompt, 600, 0.3);
}

/**
 * Predict goal completion timeline and provide actionable advice.
 */
export async function generateGoalPrediction(
  context: string
): Promise<string> {
  const prompt = `You are FinanceAI, a personal finance assistant.

Financial Goal:

${context}

Predict:

- Completion Time
- Goal Health Score (out of 100)
- Suggestions
- Risks
- Improvement Tips

Maximum 200 words.`;

  return askAI(prompt, 400, 0.3);
}

/**
 * Generate comprehensive financial insights from context.
 */
export async function generateInsights(
  context: string
): Promise<string> {
  const prompt = `You are FinanceAI, a personal finance assistant.

Analyze this financial information:

${context}

Generate:

- Spending Insights
- Saving Analysis
- Budget Health
- Positive Habits
- Warning Signs
- Actionable Recommendations

Maximum 300 words.`;

  return askAI(prompt, 600, 0.3);
}

// ─── Error Classification ──────────────────────────────────────

function classifyError(error: any): AppError {
  const message = error.message || "Unknown AI Error";
  const status = error.status || error.code;

  if (status === 401 || message.includes("401") || message.includes("unauthorized") || message.includes("Invalid")) {
    return new AppError(401, "Invalid Groq API Key. Please check your GROQ_API_KEY environment variable.");
  }

  if (status === 429 || message.includes("429") || message.includes("rate")) {
    return new AppError(429, "Groq rate limit exceeded. Please try again later.");
  }

  if (status === 503 || message.includes("503") || message.includes("unavailable")) {
    return new AppError(503, "Groq service temporarily unavailable. Please try again.");
  }

  if (message.includes("network") || message.includes("timeout") || message.includes("ECONNREFUSED") || message.includes("ETIMEDOUT")) {
    return new AppError(503, "Groq network error. Please check your connection and try again.");
  }

  return new AppError(500, "Groq AI service error. Please try again later.");
}
