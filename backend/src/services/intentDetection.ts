// ─── Intent Types ──────────────────────────────────────────────
export type FinanceIntent =
  | 'income'
  | 'expenses'
  | 'savings'
  | 'balance'
  | 'budget_status'
  | 'budget_creation'
  | 'goals'
  | 'goal_progress'
  | 'food_expenses'
  | 'category_spending'
  | 'recent_transactions'
  | 'spending_analysis'
  | 'savings_advice'
  | 'financial_insights'
  | 'general_chat';

// ─── Intent Match Rules ────────────────────────────────────────

interface IntentRule {
  intent: FinanceIntent;
  patterns: RegExp[];
  /** Higher priority rules are checked first */
  priority: number;
}

const INTENT_RULES: IntentRule[] = [
  // ── Income ────────────────────────────────────────────────
  {
    intent: 'income',
    priority: 95,
    patterns: [
      /(?:how\s+much|what|total|did)\s+(?:did\s+I\s+)?(?:earn|make|get|receive|income)/i,
      /(?:my\s+)?(?:income|salary|earning|payout)s?\s+(?:this\s+)?(?:month|year|week)/i,
      /how\s+much\s+(?:money\s+)?came\s+in/i,
      /(?:total|monthly)\s+income/i,
      /what(?:'s|\s+is)\s+my\s+(?:income|salary|earning)/i,
      /how\s+much\s+did\s+I\s+earn/i,
      /how\s+much\s+am\s+I\s+earning/i,
    ],
  },

  // ── Expenses ──────────────────────────────────────────────
  {
    intent: 'expenses',
    priority: 95,
    patterns: [
      /(?:how\s+much|what|total|did)\s+(?:did\s+I\s+)?(?:spend|expense|pay|cost)/i,
      /(?:my\s+)?(?:expense|spending|cost)s?\s+(?:this\s+)?(?:month|year|week)/i,
      /how\s+much\s+(?:money\s+)?(?:went\s+out|spent)/i,
      /(?:total|monthly)\s+(?:expense|spending)/i,
      /what(?:'s|\s+is)\s+my\s+(?:total\s+)?(?:spending|expense)/i,
      /how\s+much\s+did\s+I\s+spend/i,
      /how\s+much\s+am\s+I\s+spending/i,
    ],
  },

  // ── Food Expenses ─────────────────────────────────────────
  {
    intent: 'food_expenses',
    priority: 99,
    patterns: [
      /(?:how\s+much|what|total)\s+(?:did\s+I\s+)?(?:spend|pay|cost)\s+on\s+food/i,
      /(?:my\s+)?food\s+(?:expense|spending|cost|bill)s?\s+(?:this\s+)?(?:month|year|week)/i,
      /how\s+much\s+(?:money\s+)?(?:spent|spend)\s+on\s+(?:eating|groceries|food)/i,
      /food\s+expenses/i,
      /what\s+(?:are\s+)?(?:my\s+)?food\s+(?:expenses|costs|spending)/i,
    ],
  },

  // ── Category Spending ─────────────────────────────────────
  {
    intent: 'category_spending',
    priority: 99,
    patterns: [
      /(?:how\s+much|what|total)\s+(?:did\s+I\s+)?(?:spend|pay|cost)\s+on\s+(?!food\b)(\w+)/i,
      /(?:my\s+)?(\w+)\s+(?:expense|spending|cost|bill)s?\s+(?:this\s+)?(?:month|year|week)/i,
      /(?:spending|expenses)\s+(?:by|per|for)\s+category/i,
      /(?:category|category-wise)\s+(?:spending|expense|breakdown)/i,
      /how\s+much\s+(?:am\s+I\s+)?spending\s+on\s+(\w+)/i,
    ],
  },

  // ── Savings ───────────────────────────────────────────────
  {
    intent: 'savings',
    priority: 95,
    patterns: [
      /(?:how\s+much|what|total)\s+(?:have\s+I|did\s+I)\s+(?:saved|save)/i,
      /(?:my\s+)?(?:saving|savings)\s+(?:this\s+)?(?:month|year|account)?/i,
      /how\s+much\s+(?:money\s+)?(?:have\s+I\s+)?(?:saved|save)/i,
      /(?:total|current)\s+savings/i,
      /what(?:'s|\s+is)\s+my\s+(?:savings|saving)\s+(?:balance|amount)/i,
      /how\s+much\s+have\s+I\s+saved/i,
    ],
  },

  // ── Balance ───────────────────────────────────────────────
  {
    intent: 'balance',
    priority: 95,
    patterns: [
      /(?:what\s+(?:is|'s)|how\s+much\s+is)\s+my\s+(?:balance|account\s+balance)/i,
      /(?:remaining|current)\s+balance/i,
      /how\s+much\s+(?:money\s+)?do\s+I\s+have/i,
      /what(?:'s|\s+is)\s+my\s+(?:net\s+)?worth/i,
      /(?:total\s+)?balance/i,
    ],
  },

  // ── Budget Status (direct DB) ────────────────────────────
  {
    intent: 'budget_status',
    priority: 92,
    patterns: [
      /(?:how\s+much|what|my)\s+(?:budget|budgets)/i,
      /(?:remaining|left)\s+budget/i,
      /budget\s+(?:remaining|left|status)/i,
      /how\s+much\s+(?:budget|budgets)\s+(?:do\s+I\s+)?(?:have|left|remaining)/i,
      /(?:show|list|view)\s+(?:my\s+)?budgets/i,
      /what\s+(?:is|'s)\s+my\s+budget\s+(?:status|situation)/i,
      /how\s+am\s+I\s+doing\s+with\s+my\s+budgets/i,
      /budget\s+(?:status|situation|overview)/i,
    ],
  },

  // ── Budget Creation (Gemini) ────────────────────────────
  {
    intent: 'budget_creation',
    priority: 85,
    patterns: [
      /(?:create|make|set\s+up|build|generate|give\s+me)\s+(?:a\s+)?(?:new\s+)?budget/i,
      /(?:create|make|set\s+up)\s+(?:a\s+)?budget\s+(?:for\s+me|plan|for)\s*/i,
      /help\s+me\s+(?:create|make|plan|set\s+up)\s+(?:a\s+)?budget/i,
      /i\s+need\s+(?:a\s+)?budget/i,
      /budget\s+(?:creation|planner|planning|suggestion|recommendation)/i,
      /suggest\s+(?:a\s+)?budget/i,
      /recommend\s+(?:a\s+)?budget/i,
    ],
  },

  // ── Goals ────────────────────────────────────────────────
  {
    intent: 'goals',
    priority: 90,
    patterns: [
      /(?:my\s+)?(?:saving|savings)\s+(?:goal|goals)/i,
      /(?:show|list|view)\s+(?:my\s+)?(?:goal|goals)/i,
      /what\s+(?:are\s+)?(?:my\s+)?(?:savings\s+)?goals/i,
      /(?:show|list)\s+(?:my\s+)?savings\s+goals/i,
      /display\s+(?:my\s+)?goals/i,
    ],
  },

  // ── Goal Progress (direct DB) ───────────────────────────
  {
    intent: 'goal_progress',
    priority: 92,
    patterns: [
      /(?:progress|status)\s+(?:of|on|for)\s+(?:my\s+)?(?:goal|goals)/i,
      /how\s+(?:are\s+)?(?:my\s+)?(?:goals|savings\s+goals)\s+(?:doing|progressing)/i,
      /goal\s+(?:progress|status|tracking)/i,
      /how\s+much\s+(?:progress|closer)\s+(?:have\s+I\s+)?made\s+on\s+my\s+goals/i,
      /what\s+(?:is|'s)\s+my\s+goal\s+progress/i,
      /track\s+(?:my\s+)?(?:goal|goals)/i,
      /how\s+close\s+am\s+I\s+to\s+my\s+(?:goal|goals)/i,
    ],
  },

  // ── Recent Transactions (direct DB) ─────────────────────
  {
    intent: 'recent_transactions',
    priority: 92,
    patterns: [
      /(?:show|list|view|get)\s+(?:my\s+)?(?:recent|latest|last)\s+(?:transaction|transactions)/i,
      /what\s+(?:are\s+)?(?:my\s+)?(?:recent|latest)\s+(?:transaction|transactions)/i,
      /(?:transaction|transactions)\s+(?:history|list|log)/i,
      /(?:show|list)\s+(?:all\s+)?(?:my\s+)?(?:transaction|transactions)/i,
      /what\s+(?:did\s+I\s+)?(?:spend|buy)\s+(?:recently|lately)/i,
      /recent\s+(?:transactions|activity|spending)/i,
      /latest\s+transactions/i,
    ],
  },

  // ── Spending Analysis (Gemini) ──────────────────────────
  {
    intent: 'spending_analysis',
    priority: 80,
    patterns: [
      /analyze\s+(?:my\s+)?(?:spending|expenses|transactions)/i,
      /(?:spending|expense)\s+analysis/i,
      /analyze\s+(?:my\s+)?(?:financial|finance|money)/i,
      /(?:how\s+|where\s+)(?:am\s+I|is\s+my\s+money)\s+(?:spending|going)/i,
      /(?:break\s+down|breakdown)\s+(?:my\s+)?(?:spending|expenses)/i,
      /(?:deep\s+dive|analysis)\s+(?:into\s+)?(?:my\s+)?(?:finances|spending)/i,
      /what\s+are\s+my\s+(?:top|biggest|largest)\s+(?:expenses|spending|costs)/i,
      /spending\s+patterns/i,
      /spending\s+trends/i,
    ],
  },

  // ── Savings Advice (Gemini) ─────────────────────────────
  {
    intent: 'savings_advice',
    priority: 80,
    patterns: [
      /(?:help\s+me|how\s+(?:can\s+I|to))\s+(?:save|save\s+money)/i,
      /(?:tips|advice|suggestions|ideas|recommendations)\s+(?:for|to|on)\s+(?:saving|save)/i,
      /how\s+(?:can\s+I|to)\s+(?:reduce|cut|lower)\s+(?:my\s+)?(?:expenses|spending|costs)/i,
      /save\s+more\s+money/i,
      /savings\s+(?:tips|advice|strategy|strategies)/i,
      /(?:how\s+do\s+I|help\s+me)\s+(?:save|cut\s+costs|reduce\s+spending)/i,
      /better\s+(?:manage|save)\s+(?:my\s+)?money/i,
      /money\s+saving\s+(?:tips|advice|ideas|hacks)/i,
    ],
  },

  // ── Financial Insights (Gemini) ─────────────────────────
  {
    intent: 'financial_insights',
    priority: 75,
    patterns: [
      /(?:financial|finance)\s+(?:insights|health|analysis|overview)/i,
      /give\s+(?:me\s+)?(?:financial|some)\s+(?:insights|advice|tips)/i,
      /(?:how\s+(?:is|'s)|what\s+(?:is|'s))\s+(?:my\s+)?(?:financial\s+)?health/i,
      /(?:overall|general)\s+(?:financial|finance)\s+(?:picture|situation|status)/i,
      /(?:assess|evaluate|review)\s+(?:my\s+)?(?:financial|finance)/i,
      /financial\s+(?:assessment|evaluation|score)/i,
      /how\s+am\s+I\s+(?:doing|managing)\s+(?:financially|with\s+money)/i,
      /summary\s+of\s+my\s+finances/i,
    ],
  },
];

// ─── Intent Detection ──────────────────────────────────────────
/**
 * Detects the financial intent of a user message.
 * Returns the matched intent or 'general_chat' as fallback.
 */
export function detectIntent(message: string): FinanceIntent {
  const trimmed = message.trim();

  if (!trimmed) return 'general_chat';

  // Sort rules by priority (highest first)
  const sortedRules = [...INTENT_RULES].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) {
        console.log(`🔍 [Intent] Matched intent '${rule.intent}' via pattern /${pattern.source}/`);
        return rule.intent;
      }
    }
  }

  // Fallback: if not matched, route to general chat (Gemini)
  console.log(`🔍 [Intent] No match found, routing to 'general_chat'`);
  return 'general_chat';
}

// ─── Intent Descriptions ───────────────────────────────────────
export const INTENT_LABELS: Record<FinanceIntent, string> = {
  income: 'Income Query',
  expenses: 'Expenses Query',
  savings: 'Savings Query',
  balance: 'Balance Query',
  budget_status: 'Budget Status Query',
  budget_creation: 'Budget Creation',
  goals: 'Savings Goals Query',
  goal_progress: 'Goal Progress Query',
  food_expenses: 'Food Expenses Query',
  category_spending: 'Category Spending Query',
  recent_transactions: 'Recent Transactions Query',
  spending_analysis: 'Spending Analysis',
  savings_advice: 'Savings Advice',
  financial_insights: 'Financial Insights',
  general_chat: 'General Chat',
};

// ─── Route Selection ───────────────────────────────────────────
/**
 * Whether this intent should be handled via direct database query (true)
 * or routed to Gemini AI (false).
 */
export function isDirectQueryIntent(intent: FinanceIntent): boolean {
  return [
    'income',
    'expenses',
    'savings',
    'balance',
    'budget_status',
    'goals',
    'goal_progress',
    'food_expenses',
    'category_spending',
    'recent_transactions',
  ].includes(intent);
}

/**
 * Whether this intent needs AI analysis from Gemini.
 */
export function isAIIntent(intent: FinanceIntent): boolean {
  return [
    'budget_creation',
    'spending_analysis',
    'savings_advice',
    'financial_insights',
    'general_chat',
  ].includes(intent);
}
