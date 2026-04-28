import type { RecurringPayment, Transaction } from "../../types";
import { addDays, daysBetween } from "../../utils/dates";
import { merchantKey } from "../../utils/text";

export function detectRecurringPayments(transactions: Transaction[]): RecurringPayment[] {
  const groups = new Map<string, Transaction[]>();

  transactions
    .filter((transaction) => transaction.debit > 0 && transaction.category !== "Transfers")
    .forEach((transaction) => {
      const key = `${transaction.accountId}-${merchantKey(transaction.description)}-${Math.round(
        Math.abs(transaction.amount) / 100,
      )}`;
      groups.set(key, [...(groups.get(key) ?? []), transaction]);
    });

  return [...groups.values()]
    .map((group) => group.sort((a, b) => a.date.localeCompare(b.date)))
    .filter((group) => group.length >= 2)
    .map((group) => {
      const gaps = group.slice(1).map((transaction, index) => daysBetween(group[index].date, transaction.date));
      const averageGapDays = Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
      const amount =
        group.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0) / group.length;
      const gapConfidence = gaps.filter((gap) => Math.abs(gap - averageGapDays) <= 5).length / gaps.length;
      const last = group[group.length - 1];

      return {
        merchant: merchantKey(last.description),
        accountId: last.accountId,
        category: last.category,
        amount,
        averageGapDays,
        lastPaidDate: last.date,
        nextExpectedDate: addDays(last.date, averageGapDays),
        confidence: Math.min(0.95, Math.max(0.45, gapConfidence)),
        transactionIds: group.map((transaction) => transaction.id),
      };
    })
    .filter((payment) => payment.averageGapDays >= 20 && payment.averageGapDays <= 45)
    .sort((a, b) => a.nextExpectedDate.localeCompare(b.nextExpectedDate));
}
