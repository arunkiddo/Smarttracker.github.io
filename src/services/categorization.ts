import type { Category, CategoryRule, Transaction } from "../types";
import { merchantKey, normalizeText } from "../utils/text";
import { askGroqForCategory } from "./groqClient";

interface CategoryMatch {
  category: Category;
  confidence: number;
  source: "rule" | "ai" | "manual" | "unknown";
}

const builtInRules: Array<{ category: Category; terms: string[] }> = [
  {
    category: "Food & Dining",
    terms: ["swiggy", "zomato", "restaurant", "cafe", "tea", "coffee", "hotel", "food"],
  },
  { category: "Groceries", terms: ["dmart", "grofers", "blinkit", "zepto", "bigbasket", "grocery"] },
  { category: "Shopping", terms: ["amazon", "flipkart", "myntra", "meesho", "nykaa", "store"] },
  {
    category: "Bills & Utilities",
    terms: ["airtel", "jio", "bsnl", "electricity", "bescom", "tneb", "water", "gas", "bill"],
  },
  { category: "Rent", terms: ["rent", "lease"] },
  { category: "Travel", terms: ["uber", "ola", "rapido", "irctc", "makemytrip", "metro", "flight"] },
  { category: "Fuel", terms: ["fuel", "petrol", "diesel", "hpcl", "iocl", "bharat petroleum"] },
  { category: "Health", terms: ["hospital", "pharmacy", "medical", "apollo", "clinic", "doctor"] },
  { category: "Entertainment", terms: ["netflix", "prime video", "spotify", "bookmyshow", "hotstar"] },
  { category: "Investments", terms: ["zerodha", "groww", "mutual fund", "sip", "nse", "investment"] },
  { category: "Transfers", terms: ["self", "transfer", "own account", "neft", "imps", "rtgs"] },
  { category: "Loans", terms: ["loan", "emi", "lender", "credit card"] },
  { category: "Education", terms: ["school", "college", "course", "tuition", "udemy"] },
  { category: "Fees & Charges", terms: ["charge", "charges", "fee", "gst", "penalty"] },
  { category: "Cash Withdrawal", terms: ["atm", "cash withdrawal", "nwd"] },
];

export const categories: Category[] = [
  "Income",
  "Food & Dining",
  "Groceries",
  "Shopping",
  "Bills & Utilities",
  "Rent",
  "Travel",
  "Fuel",
  "Health",
  "Entertainment",
  "Investments",
  "Transfers",
  "Loans",
  "Education",
  "Fees & Charges",
  "Cash Withdrawal",
  "Miscellaneous",
  "Uncategorized",
];

export function categorizeByRules(
  description: string,
  amount: number,
  savedRules: CategoryRule[],
): CategoryMatch {
  if (amount > 0) {
    return { category: "Income", confidence: 0.95, source: "rule" };
  }

  const normalized = normalizeText(description);
  const customRule = savedRules.find((rule) => normalized.includes(normalizeText(rule.pattern)));
  if (customRule) {
    return { category: customRule.category, confidence: 0.98, source: "manual" };
  }

  for (const rule of builtInRules) {
    if (rule.terms.some((term) => normalized.includes(term))) {
      return { category: rule.category, confidence: 0.85, source: "rule" };
    }
  }

  return { category: "Uncategorized", confidence: 0.2, source: "unknown" };
}

export async function categorizeTransaction(
  transaction: Transaction,
  savedRules: CategoryRule[],
): Promise<Transaction> {
  const ruleMatch = categorizeByRules(transaction.description, transaction.amount, savedRules);
  if (ruleMatch.confidence >= 0.8 || transaction.amount > 0) {
    return {
      ...transaction,
      category: ruleMatch.category,
      categoryConfidence: ruleMatch.confidence,
      categorySource: ruleMatch.source,
    };
  }

  try {
    const aiMatch = await askGroqForCategory(transaction.description, Math.abs(transaction.amount));
    if (aiMatch && aiMatch.confidence >= 0.55) {
      return {
        ...transaction,
        category: aiMatch.category,
        categoryConfidence: aiMatch.confidence,
        categorySource: "ai",
      };
    }
  } catch (error) {
    console.warn("AI categorization failed", error);
  }

  return {
    ...transaction,
    category: ruleMatch.category,
    categoryConfidence: ruleMatch.confidence,
    categorySource: "unknown",
  };
}

export function createRuleFromCorrection(transaction: Transaction, category: Category): CategoryRule {
  return {
    id: crypto.randomUUID(),
    pattern: merchantKey(transaction.description),
    category,
    createdAt: new Date().toISOString(),
  };
}
