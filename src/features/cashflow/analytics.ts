import type { Category, DateRange, Transaction, TransactionKind } from "../../types";
import { isWithinRange, monthKey } from "../../utils/dates";

export interface CashflowTotals {
  income: number;
  investments: number;
  spends: number;
}

export function filterTransactions(
  transactions: Transaction[],
  accountId: string,
  range: DateRange,
) {
  return transactions.filter((transaction) => {
    const matchesAccount = accountId === "all" || transaction.accountId === accountId;
    return matchesAccount && isWithinRange(transaction.date, range);
  });
}

export function getTransactionKind(transaction: Transaction): TransactionKind {
  if (transaction.credit > 0) {
    return "income";
  }

  if (transaction.category === "Investments") {
    return "investment";
  }

  if (transaction.category === "Transfers") {
    return "transfer";
  }

  return "spend";
}

export function getCashflowTotals(transactions: Transaction[]): CashflowTotals {
  return transactions.reduce(
    (totals, transaction) => {
      const amount = Math.abs(transaction.amount);
      const kind = getTransactionKind(transaction);

      if (kind === "income") {
        totals.income += amount;
      } else if (kind === "investment") {
        totals.investments += amount;
      } else if (kind === "spend") {
        totals.spends += amount;
      }

      return totals;
    },
    { income: 0, investments: 0, spends: 0 },
  );
}

export function getCategoryBreakdown(transactions: Transaction[]) {
  const spends = transactions.filter((transaction) => getTransactionKind(transaction) === "spend");
  const total = spends.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const grouped = new Map<Category, number>();

  spends.forEach((transaction) => {
    grouped.set(transaction.category, (grouped.get(transaction.category) ?? 0) + Math.abs(transaction.amount));
  });

  return [...grouped.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function getMonthlySpends(transactions: Transaction[]) {
  const grouped = new Map<string, number>();

  transactions
    .filter((transaction) => getTransactionKind(transaction) === "spend")
    .forEach((transaction) => {
      const key = monthKey(transaction.date);
      grouped.set(key, (grouped.get(key) ?? 0) + Math.abs(transaction.amount));
    });

  return [...grouped.entries()]
    .map(([month, spends]) => ({ month, spends }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function getTopSpends(transactions: Transaction[], limit = 6) {
  return transactions
    .filter((transaction) => getTransactionKind(transaction) === "spend")
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, limit);
}
