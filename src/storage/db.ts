import { openDB, type DBSchema } from "idb";
import type { Account, AppState, CategoryRule, Transaction } from "../types";

interface SmartTrackerDb extends DBSchema {
  accounts: {
    key: string;
    value: Account;
  };
  transactions: {
    key: string;
    value: Transaction;
    indexes: {
      "by-account": string;
      "by-import": string;
    };
  };
  rules: {
    key: string;
    value: CategoryRule;
  };
}

const DB_NAME = "smart-cashflow-tracker";
const DB_VERSION = 1;

async function getDb() {
  return openDB<SmartTrackerDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("accounts")) {
        db.createObjectStore("accounts", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("transactions")) {
        const transactions = db.createObjectStore("transactions", { keyPath: "id" });
        transactions.createIndex("by-account", "accountId");
        transactions.createIndex("by-import", "importId");
      }

      if (!db.objectStoreNames.contains("rules")) {
        db.createObjectStore("rules", { keyPath: "id" });
      }
    },
  });
}

export async function loadAppState(): Promise<AppState> {
  const db = await getDb();
  const [accounts, transactions, rules] = await Promise.all([
    db.getAll("accounts"),
    db.getAll("transactions"),
    db.getAll("rules"),
  ]);

  return {
    accounts: accounts.sort((a, b) => a.bankName.localeCompare(b.bankName)),
    transactions: transactions.sort((a, b) => b.date.localeCompare(a.date)),
    rules,
  };
}

export async function saveAccountsAndTransactions(
  accounts: Account[],
  transactions: Transaction[],
) {
  const db = await getDb();
  const tx = db.transaction(["accounts", "transactions"], "readwrite");

  await Promise.all([
    ...accounts.map((account) => tx.objectStore("accounts").put(account)),
    ...transactions.map((transaction) => tx.objectStore("transactions").put(transaction)),
  ]);
  await tx.done;
}

export async function saveTransaction(transaction: Transaction) {
  const db = await getDb();
  await db.put("transactions", transaction);
}

export async function saveRule(rule: CategoryRule) {
  const db = await getDb();
  await db.put("rules", rule);
}

export async function clearAllData() {
  const db = await getDb();
  const tx = db.transaction(["accounts", "transactions", "rules"], "readwrite");
  await Promise.all([
    tx.objectStore("accounts").clear(),
    tx.objectStore("transactions").clear(),
    tx.objectStore("rules").clear(),
  ]);
  await tx.done;
}
