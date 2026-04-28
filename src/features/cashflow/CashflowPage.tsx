import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Account, DateRange, Transaction } from "../../types";
import { displayDate } from "../../utils/dates";
import { formatCurrency } from "../../utils/money";
import {
  filterTransactions,
  getCashflowTotals,
  getCategoryBreakdown,
  getMonthlySpends,
  getTopSpends,
} from "./analytics";

interface CashflowPageProps {
  accounts: Account[];
  transactions: Transaction[];
  accountId: string;
  dateRange: DateRange;
  showSpendDetail: boolean;
  onAccountChange: (accountId: string) => void;
  onDateRangeChange: (range: DateRange) => void;
  onShowSpendDetail: (value: boolean) => void;
}

const colors = ["#59316b", "#c887df", "#f2d1ff", "#7b478c", "#d9b6e8", "#2f7d72", "#d9a441"];

export function CashflowPage({
  accounts,
  transactions,
  accountId,
  dateRange,
  showSpendDetail,
  onAccountChange,
  onDateRangeChange,
  onShowSpendDetail,
}: CashflowPageProps) {
  const visibleTransactions = filterTransactions(transactions, accountId, dateRange);
  const totals = getCashflowTotals(visibleTransactions);
  const chartData = [
    { name: "Income", value: totals.income, key: "income" },
    { name: "Investments", value: totals.investments, key: "investment" },
    { name: "Spends", value: totals.spends, key: "spend" },
  ];
  const categories = getCategoryBreakdown(visibleTransactions);
  const monthly = getMonthlySpends(visibleTransactions);
  const topSpends = getTopSpends(visibleTransactions);

  return (
    <section className="screen">
      <div className="toolbar">
        <select value={accountId} onChange={(event) => onAccountChange(event.target.value)}>
          <option value="all">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.bankName} · {account.accountNumber}
            </option>
          ))}
        </select>
        <input
          aria-label="Start date"
          onChange={(event) => onDateRangeChange({ ...dateRange, start: event.target.value })}
          type="date"
          value={dateRange.start}
        />
        <input
          aria-label="End date"
          onChange={(event) => onDateRangeChange({ ...dateRange, end: event.target.value })}
          type="date"
          value={dateRange.end}
        />
      </div>

      {!showSpendDetail ? (
        <>
          <div className="section-heading">
            <p className="eyebrow">Your cash flow</p>
            <h1>{formatCurrency(totals.income - totals.investments - totals.spends)}</h1>
            <p>
              {displayDate(dateRange.start)} to {displayDate(dateRange.end)}
            </p>
          </div>

          <article className="card chart-card">
            <ResponsiveContainer height={290} width="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar
                  dataKey="value"
                  onClick={(entry) => {
                    if (entry.key === "spend") {
                      onShowSpendDetail(true);
                    }
                  }}
                  radius={[12, 12, 0, 0]}
                >
                  {chartData.map((entry, index) => (
                    <Cell cursor={entry.key === "spend" ? "pointer" : "default"} fill={colors[index]} key={entry.key} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="hint">Click the spends bar to open category and month-wise analysis.</p>
          </article>

          <div className="summary-list">
            <SummaryRow label="Incoming" value={totals.income} />
            <SummaryRow label="Investments" value={totals.investments} />
            <SummaryRow label="Spends" value={totals.spends} emphasis />
          </div>
        </>
      ) : (
        <div className="spend-detail">
          <button className="text-button" onClick={() => onShowSpendDetail(false)} type="button">
            Back to cash flow
          </button>
          <div className="section-heading centered">
            <p className="eyebrow">Selected spends</p>
            <h1>{formatCurrency(totals.spends)}</h1>
            <p>Avg per month based on selected range</p>
          </div>

          <div className="two-column">
            <article className="card chart-card">
              <ResponsiveContainer height={270} width="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="amount"
                    innerRadius={70}
                    nameKey="category"
                    outerRadius={105}
                    paddingAngle={2}
                  >
                    {categories.map((entry, index) => (
                      <Cell fill={colors[index % colors.length]} key={entry.category} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </article>

            <article className="card">
              <h2>Category split</h2>
              <div className="category-list">
                {categories.map((category) => (
                  <div className="category-row" key={category.category}>
                    <span>
                      {category.category}
                      <small>{category.percentage.toFixed(1)}%</small>
                    </span>
                    <strong>{formatCurrency(category.amount)}</strong>
                  </div>
                ))}
                {!categories.length && <p className="muted">No spends in this period.</p>}
              </div>
            </article>
          </div>

          <div className="two-column">
            <article className="card">
              <h2>Top spends</h2>
              <div className="top-spends">
                {topSpends.map((transaction) => (
                  <div className="mini-spend" key={transaction.id}>
                    <span>{transaction.description.slice(0, 24) || transaction.category}</span>
                    <strong>{formatCurrency(Math.abs(transaction.amount))}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="card chart-card">
              <h2>Spends history</h2>
              <ResponsiveContainer height={230} width="100%">
                <BarChart data={monthly}>
                  <XAxis dataKey="month" />
                  <YAxis hide />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="spends" fill="#59316b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </article>
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryRow({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <article className={emphasis ? "summary-row is-emphasis" : "summary-row"}>
      <span>{label}</span>
      <strong>{formatCurrency(value)}</strong>
    </article>
  );
}
