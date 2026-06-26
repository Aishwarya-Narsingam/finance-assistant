export type IntentType =
  | 'CATEGORY_ANALYSIS'
  | 'BUDGET'
  | 'GOALS'
  | 'INCOME'
  | 'EXPENSES'
  | 'SAVINGS'
  | 'TRANSACTIONS'
  | 'REPORTS'
  | 'RECOMMENDATIONS'
  | 'GREETING'
  | 'GENERAL_FINANCE';

export interface IntentResult {
  intent: IntentType;
  category: string | null;
}

// ─── Category patterns (for CATEGORY_ANALYSIS intent) ─────────

const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  FOOD: [/food/i, /groceries/i, /grocery/i, /restaurant/i, /dining/i, /eat/i, /meal/i, /lunch/i, /dinner/i, /breakfast/i, /snack/i, /cafe/i, /coffee/i, /tea/i, /bakery/i, /pizza/i, /burger/i, /zomato/i, /swiggy/i],
  TRAVEL: [/travel/i, /transport/i, /fuel/i, /gas/i, /petrol/i, /diesel/i, /uber/i, /ola/i, /cab/i, /taxi/i, /bus/i, /train/i, /flight/i, /commute/i, /metro/i, /auto/i, /parking/i, /toll/i],
  SHOPPING: [/shopping/i, /clothes/i, /clothing/i, /apparel/i, /electronics/i, /gadget/i, /amazon/i, /flipkart/i, /myntra/i, /online.?shop/i, /mall/i, /store/i, /retail/i],
  BILLS: [/bill/i, /utility/i, /electricity/i, /water/i, /internet/i, /phone/i, /mobile/i, /subscription/i, /recharge/i, /broadband/i, /wifi/i, /cable/i, /gas.?bill/i],
  RENT: [/rent/i, /lease/i, /housing/i, /accommodation/i, /emi/i, /mortgage/i, /property/i, /maintenance/i, /society/i],
  INVESTMENT: [/invest/i, /stock/i, /mutual.?fund/i, /sip/i, /share/i, /bond/i, /fd/i, /fixed.?deposit/i, /trading/i, /portfolio/i, /nifty/i, /sensex/i],
  ENTERTAINMENT: [/entertainment/i, /movie/i, /netflix/i, /prime/i, /hotstar/i, /ott/i, /game/i, /gaming/i, /sport/i, /concert/i, /hobby/i, /music/i, /party/i, /outing/i, /fun/i],
  HEALTHCARE: [/health/i, /medical/i, /doctor/i, /hospital/i, /medicine/i, /pharmacy/i, /insurance/i, /fitness/i, /gym/i, /wellness/i, /clinic/i, /check.?up/i, /diagnostic/i, /lab/i, /dentist/i],
  EDUCATION: [/education/i, /course/i, /tuition/i, /tutorial/i, /book/i, /college/i, /school/i, /university/i, /training/i, /certification/i, /exam/i, /fee/i, /library/i],
  SALARY: [/salary/i, /payroll/i, /wage/i, /income/i, /earning/i, /payout/i, /paycheck/i, /remuneration/i, /credit.?salary/i],
  FREELANCE: [/freelance/i, /contract/i, /gig/i, /consulting/i, /project.?income/i, /side.?hustle/i],
};

// ─── Intent patterns ──────────────────────────────────────────

const INTENT_PATTERNS: [IntentType, RegExp[]][] = [
  ['BUDGET', [/budget/i, /50\/30\/20/i, /spending plan/i, /allocate/i, /how much should I spend/i]],
  ['GOALS', [/goal/i, /save for/i, /saving for/i, /target/i, /deadline/i, /milestone/i, /dream/i, /vacation fund/i, /emergency fund/i, /goal prediction/i, /when will I/i]],
  ['INCOME', [/income/i, /earn/i, /salary/i, /pay/i, /received/i, /credited/i, /payout/i, /how much did I make/i, /total income/i, /earning/i]],
  ['EXPENSES', [/expense/i, /spend/i, /spent/i, /cost/i, /paid/i, /outflow/i, /how much did I spend/i, /total expense/i, /where did my money go/i, /burn rate/i]],
  ['SAVINGS', [/save/i, /saving/i, /savings/i, /set aside/i, /put away/i, /savings rate/i, /how much can I save/i, /save more/i, /increase savings/i]],
  ['TRANSACTIONS', [/transaction/i, /recent/i, /last/i, /history/i, /list/i, /show me/i, /transactions/i, /all my/i]],
  ['REPORTS', [/report/i, /summary/i, /overview/i, /monthly/i, /this month/i, /this week/i, /performance/i, /statement/i, /snapshot/i]],
  ['RECOMMENDATIONS', [/recommend/i, /suggest/i, /advice/i, /tip/i, /what should i/i, /how can i/i, /improve/i, /optimize/i, /reduce/i, /cut/i, /action/i]],
  ['GREETING', [/^hi/i, /^hello/i, /^hey/i, /^good morning/i, /^good evening/i, /^yo/i, /^sup/i, /^howdy/i, /^namaste/i, /^vanakkam/i]],
];

// ─── Detect category (from user message) ─────────────────────

function detectCategory(message: string): string | null {
  const cleaned = message.toLowerCase().trim();

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(cleaned)) {
        return category;
      }
    }
  }

  return null;
}

// ─── Detect broader intent ────────────────────────────────────

function detectMainIntent(message: string): IntentType {
  const cleaned = message.toLowerCase().trim();

  for (const [intent, patterns] of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(cleaned)) {
        return intent;
      }
    }
  }

  return 'GENERAL_FINANCE';
}

/**
 * Detect both the broad intent and the specific category from a user message.
 */
export function detectIntent(message: string): IntentResult {
  const category = detectCategory(message);
  const mainIntent = detectMainIntent(message);

  // If we detected a specific category and the intent is still GENERAL_FINANCE,
  // promote it to CATEGORY_ANALYSIS
  const intent = (category && mainIntent === 'GENERAL_FINANCE')
    ? 'CATEGORY_ANALYSIS' as IntentType
    : mainIntent;

  // If intent is EXPENSES but also has category, promote to CATEGORY_ANALYSIS
  if (category && (intent === 'EXPENSES' || intent === 'TRANSACTIONS')) {
    return { intent: 'CATEGORY_ANALYSIS', category };
  }

  return { intent, category };
}
