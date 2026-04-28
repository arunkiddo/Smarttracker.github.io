export type Category =
  | "Income"
  | "Food & Dining"
  | "Groceries"
  | "Shopping"
  | "Bills & Utilities"
  | "Rent"
  | "Travel"
  | "Fuel"
  | "Health"
  | "Entertainment"
  | "Investments"
  | "Transfers"
  | "Loans"
  | "Education"
  | "Fees & Charges"
  | "Cash Withdrawal"
  | "Miscellaneous"
  | "Uncategorized";

export type CategorySource = "rule" | "ai" | "manual" | "unknown";

export type TransactionKind = "income" | "investment" | "spend" | "transfer";

export interface Account {
  id: string;
  accountNumber: string;
  bankName: string;
  holderName?: string;
  currency: "INR";
  balance: number;
  lastImportedAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  accountNumber: string;
  bankName: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  amount: number;
  balance?: number;
  reference?: string;
  category: Category;
  categorySource: CategorySource;
  categoryConfidence: number;
  importId: string;
  raw: string[];
}

export interface CategoryRule {
  id: string;
  pattern: string;
  category: Category;
  createdAt: string;
}

export interface ImportResult {
  importId: string;
  fileName: string;
  account: Account;
  transactions: Transaction[];
  duplicateCount: number;
  warnings: string[];
}

export interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  rules: CategoryRule[];
}

export interface DateRange {
  start: string;
  end: string;
}

export interface RecurringPayment {
  merchant: string;
  accountId: string;
  category: Category;
  amount: number;
  averageGapDays: number;
  lastPaidDate: string;
  nextExpectedDate: string;
  confidence: number;
  transactionIds: string[];
}
