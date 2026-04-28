import { ArrowDownLeft, ArrowUpRight, CalendarClock, EyeOff, Landmark } from "lucide-react";
import type { Account, RecurringPayment, Transaction } from "../../types";
import { displayDate } from "../../utils/dates";
import { formatCurrency } from "../../utils/money";

interface DashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  recurringPayments: RecurringPayment[];
  privacyMode: boolean;
  onUpdateAccount: (account: Account) => Promise<void>;
  onTogglePrivacy: () => void;
}

export function Dashboard({
  accounts,
  transactions,
  recurringPayments,
  privacyMode,
  onUpdateAccount,
  onTogglePrivacy,
}: DashboardProps) {
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const latestTransactions = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const moneyClass = privacyMode ? "money is-private" : "money";

  return (
    <section className="screen">
      <div className="hero">
        <div>
          <p className="eyebrow">Total balance</p>
          <h1 className={moneyClass}>{formatCurrency(totalBalance)}</h1>
          <p>Across {accounts.length || 0} imported accounts</p>
        </div>
        <button className="icon-button" onClick={onTogglePrivacy} type="button">
          <EyeOff aria-hidden="true" />
          {privacyMode ? "Show" : "Privacy"}
        </button>
      </div>

      <div className="grid account-grid">
        {accounts.length ? (
          accounts.map((account) => (
            <article className="card account-card" key={account.id}>
              <Landmark aria-hidden="true" />
              <div>
                <h3>{account.bankName}</h3>
                <p>Account {account.accountNumber}</p>
              </div>
              <button
                className="text-link"
                onClick={() => void editAccount(account, onUpdateAccount)}
                type="button"
              >
                Edit
              </button>
              <strong className={moneyClass}>{formatCurrency(account.balance)}</strong>
            </article>
          ))
        ) : (
          <article className="card empty-card">
            <h3>No accounts yet</h3>
            <p>Upload your first statement to build the dashboard.</p>
          </article>
        )}
      </div>

      <div className="two-column">
        <article className="card">
          <div className="section-title">
            <h2>Last 5 transactions</h2>
            <span>{latestTransactions.length} shown</span>
          </div>
          <div className="transaction-list">
            {latestTransactions.map((transaction) => (
              <div className="transaction-row" key={transaction.id}>
                <div className={transaction.credit > 0 ? "txn-icon income" : "txn-icon spend"}>
                  {transaction.credit > 0 ? <ArrowDownLeft /> : <ArrowUpRight />}
                </div>
                <div>
                  <strong>{transaction.description}</strong>
                  <p>
                    {displayDate(transaction.date)} · {transaction.category}
                  </p>
                </div>
                <span className={transaction.credit > 0 ? "amount income-text" : "amount"}>
                  {formatCurrency(Math.abs(transaction.amount))}
                </span>
              </div>
            ))}
            {!latestTransactions.length && <p className="muted">No transactions imported yet.</p>}
          </div>
        </article>

        <article className="card">
          <div className="section-title">
            <h2>Recurring payments</h2>
            <CalendarClock aria-hidden="true" />
          </div>
          <div className="transaction-list compact">
            {recurringPayments.slice(0, 5).map((payment) => (
              <div className="transaction-row" key={`${payment.accountId}-${payment.merchant}`}>
                <div>
                  <strong>{payment.merchant}</strong>
                  <p>Next around {displayDate(payment.nextExpectedDate)}</p>
                </div>
                <span className="amount">{formatCurrency(payment.amount)}</span>
              </div>
            ))}
            {!recurringPayments.length && (
              <p className="muted">Recurring payments appear after at least two similar monthly spends.</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function editAccount(account: Account, onUpdateAccount: (account: Account) => Promise<void>) {
  const bankName = window.prompt("Bank name", account.bankName)?.trim();
  if (!bankName) {
    return;
  }

  const accountNumber = window.prompt("Account number", account.accountNumber)?.trim();
  if (!accountNumber) {
    return;
  }

  void onUpdateAccount({
    ...account,
    bankName,
    accountNumber,
  });
}
