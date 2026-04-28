import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { BarChart3, Database, Home, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Dashboard } from "./features/accounts/Dashboard";
import { FileImporter } from "./features/import/FileImporter";
import { detectRecurringPayments } from "./features/recurring/recurring";
import {
  clearAllData,
  loadAppState,
  saveAccountsAndTransactions,
  saveRule,
  saveTransaction,
} from "./storage/db";
import type { Account, AppState, Category, DateRange, ImportResult, Transaction } from "./types";
import { getDefaultDateRange } from "./utils/dates";
import { CategoryReview } from "./components/CategoryReview";
import { createRuleFromCorrection } from "./services/categorization";

type View = "dashboard" | "cashflow";

const initialState: AppState = {
  accounts: [],
  transactions: [],
  rules: [],
};

const CashflowPage = lazy(() =>
  import("./features/cashflow/CashflowPage").then((module) => ({
    default: module.CashflowPage,
  })),
);

export default function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [view, setView] = useState<View>("dashboard");
  const [accountId, setAccountId] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [showSpendDetail, setShowSpendDetail] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [message, setMessage] = useState("Upload statements to start tracking cash flow.");

  useEffect(() => {
    loadAppState()
      .then(setState)
      .catch((error) => {
        console.error(error);
        setMessage("Unable to load browser storage.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const recurringPayments = useMemo(
    () => detectRecurringPayments(state.transactions),
    [state.transactions],
  );

  async function handleImported(result: ImportResult) {
    const accounts = mergeAccounts(state.accounts, [result.account]);
    const transactions = [...result.transactions, ...state.transactions].sort((a, b) =>
      b.date.localeCompare(a.date),
    );

    await saveAccountsAndTransactions(accounts, result.transactions);
    setState((current) => ({
      ...current,
      accounts: mergeAccounts(current.accounts, [result.account]),
      transactions: [...result.transactions, ...current.transactions].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    }));

    setMessage(
      `${result.fileName}: imported ${result.transactions.length} transactions${
        result.duplicateCount ? `, skipped ${result.duplicateCount} duplicates` : ""
      }.${result.warnings.length ? ` ${result.warnings.join(" ")}` : ""}`,
    );

    if (!transactions.length) {
      setView("dashboard");
    }
  }

  async function handleCategoryCorrection(transaction: Transaction, category: Category) {
    const updated: Transaction = {
      ...transaction,
      category,
      categorySource: "manual",
      categoryConfidence: 1,
    };
    const rule = createRuleFromCorrection(updated, category);

    await Promise.all([saveTransaction(updated), saveRule(rule)]);
    setState((current) => ({
      accounts: current.accounts,
      rules: [...current.rules, rule],
      transactions: current.transactions.map((item) => (item.id === updated.id ? updated : item)),
    }));
    setMessage(`Saved ${category} rule for similar future transactions.`);
  }

  async function handleAccountUpdate(account: Account) {
    const updatedTransactions = state.transactions.map((transaction) =>
      transaction.accountId === account.id
        ? {
            ...transaction,
            accountNumber: account.accountNumber,
            bankName: account.bankName,
          }
        : transaction,
    );

    await saveAccountsAndTransactions([account], updatedTransactions);
    setState((current) => ({
      ...current,
      accounts: current.accounts.map((item) => (item.id === account.id ? account : item)),
      transactions: current.transactions.map((transaction) =>
        transaction.accountId === account.id
          ? {
              ...transaction,
              accountNumber: account.accountNumber,
              bankName: account.bankName,
            }
          : transaction,
      ),
    }));
    setMessage("Account details updated.");
  }

  async function handleClearData() {
    const confirmed = window.confirm("Delete all imported accounts, transactions, and category rules?");
    if (!confirmed) {
      return;
    }

    await clearAllData();
    setState(initialState);
    setMessage("All local tracker data was cleared.");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">₹</span>
          <div>
            <strong>Smart Cashflow</strong>
            <small>Private bank tracker</small>
          </div>
        </div>
        <nav>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
            <Home aria-hidden="true" />
            Dashboard
          </button>
          <button className={view === "cashflow" ? "active" : ""} onClick={() => setView("cashflow")}>
            <BarChart3 aria-hidden="true" />
            Cash flow
          </button>
        </nav>
        <div className="privacy-note">
          <ShieldCheck aria-hidden="true" />
          <p>Statements are processed in your browser. Only unclear descriptions may be sent to your Groq proxy.</p>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Browser-only finance workspace</p>
            <h2>{isLoading ? "Loading tracker" : "Cash Flow Tracker"}</h2>
          </div>
          <button className="danger-button" disabled={!state.transactions.length} onClick={handleClearData}>
            <Trash2 aria-hidden="true" />
            Clear data
          </button>
        </header>

        <FileImporter
          isImporting={isImporting}
          onImported={handleImported}
          rules={state.rules}
          setIsImporting={setIsImporting}
          transactions={state.transactions}
        />

        <div className="status-strip">
          <Database aria-hidden="true" />
          <span>{message}</span>
          {isImporting && <RefreshCw className="spin" aria-hidden="true" />}
        </div>

        <CategoryReview onCorrect={handleCategoryCorrection} transactions={state.transactions} />

        {view === "dashboard" ? (
          <Dashboard
            accounts={state.accounts}
            onUpdateAccount={handleAccountUpdate}
            onTogglePrivacy={() => setPrivacyMode((value) => !value)}
            privacyMode={privacyMode}
            recurringPayments={recurringPayments}
            transactions={state.transactions}
          />
        ) : (
          <Suspense fallback={<article className="card">Loading cash flow charts...</article>}>
            <CashflowPage
              accountId={accountId}
              accounts={state.accounts}
              dateRange={dateRange}
              onAccountChange={setAccountId}
              onDateRangeChange={setDateRange}
              onShowSpendDetail={setShowSpendDetail}
              showSpendDetail={showSpendDetail}
              transactions={state.transactions}
            />
          </Suspense>
        )}
      </section>
    </main>
  );
}

function mergeAccounts(existing: Account[], incoming: Account[]) {
  const merged = new Map(existing.map((account) => [account.id, account]));

  incoming.forEach((account) => {
    merged.set(account.id, {
      ...(merged.get(account.id) ?? account),
      ...account,
    });
  });

  return [...merged.values()].sort((a, b) => a.bankName.localeCompare(b.bankName));
}
