import type { Category } from "../types";

export interface GroqCategoryResponse {
  category: Category;
  confidence: number;
  reason?: string;
}

const categories: Category[] = [
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

export async function askGroqForCategory(
  description: string,
  amount: number,
): Promise<GroqCategoryResponse | undefined> {
  const proxyUrl = import.meta.env.VITE_GROQ_PROXY_URL;
  if (!proxyUrl) {
    return undefined;
  }

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description,
      amount,
      categories,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq proxy failed with ${response.status}`);
  }

  const data = (await response.json()) as Partial<GroqCategoryResponse>;
  if (!data.category || !categories.includes(data.category)) {
    return undefined;
  }

  return {
    category: data.category,
    confidence: Math.min(Math.max(Number(data.confidence ?? 0.5), 0), 1),
    reason: data.reason,
  };
}
