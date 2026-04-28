import type { Account, CategoryRule, ImportResult, Transaction } from "../../types";
import { categorizeTransaction } from "../../services/categorization";
import { toIsoDate } from "../../utils/dates";
import { parseMoney } from "../../utils/money";
import { fingerprint, hashString } from "../../utils/text";

type Matrix = string[][];

const knownBanks = [
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "State Bank of India",
  "SBI",
  "Kotak Mahindra Bank",
  "Yes Bank",
  "Canara Bank",
  "Punjab National Bank",
  "Bank of Baroda",
  "IDFC First Bank",
  "IndusInd Bank",
];

const dateHeaders = ["date", "txn date", "transaction date", "value date", "posting date"];
const descriptionHeaders = ["description", "narration", "particular", "details", "remarks"];
const debitHeaders = ["debit", "withdrawal", "withdrawals", "paid out", "dr"];
const creditHeaders = ["credit", "deposit", "deposits", "paid in", "cr"];
const balanceHeaders = ["balance", "closing balance", "available balance"];
const referenceHeaders = ["ref", "reference", "cheque", "chq", "utr"];

export async function parseStatementFile(
  file: File,
  existingTransactions: Transaction[],
  rules: CategoryRule[],
): Promise<ImportResult> {
  const importId = crypto.randomUUID();
  const matrix = await fileToMatrix(file);
  const warnings: string[] = [];

  if (!matrix.length) {
    throw new Error("No readable rows were found in the uploaded statement.");
  }

  const flatLines = matrix.map((row) => row.join(" ").trim()).filter(Boolean);
  const account = extractAccount(file.name, flatLines);
  const parsedRows = parseTransactionRows(matrix, account, importId);

  if (!parsedRows.length) {
    warnings.push("No transaction table was detected. Check whether this bank statement layout is supported.");
  }

  const existingIds = new Set(existingTransactions.map((transaction) => transaction.id));
  const seenIds = new Set<string>();
  const uniqueRows = parsedRows.filter((transaction) => {
    if (existingIds.has(transaction.id) || seenIds.has(transaction.id)) {
      return false;
    }

    seenIds.add(transaction.id);
    return true;
  });
  const categorized = await Promise.all(
    uniqueRows.map((transaction) => categorizeTransaction(transaction, rules)),
  );

  const latestBalance = [...categorized]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((transaction) => typeof transaction.balance === "number")?.balance;

  return {
    importId,
    fileName: file.name,
    account: {
      ...account,
      balance: latestBalance ?? account.balance,
      lastImportedAt: new Date().toISOString(),
    },
    transactions: categorized,
    duplicateCount: parsedRows.length - uniqueRows.length,
    warnings,
  };
}

async function fileToMatrix(file: File): Promise<Matrix> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "xls" || extension === "xlsx") {
    return workbookToMatrix(await file.arrayBuffer());
  }

  if (extension === "pdf") {
    return textToMatrix(await readPdfText(file));
  }

  return textToMatrix(await file.text());
}

async function workbookToMatrix(buffer: ArrayBuffer): Promise<Matrix> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    return [];
  }

  return XLSX.utils
    .sheet_to_json<Array<string | number | Date | undefined>>(workbook.Sheets[firstSheet], {
      header: 1,
      raw: true,
      defval: "",
    })
    .map((row) => row.map((cell) => normalizeCell(cell)));
}

async function readPdfText(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }

  return pages.join("\n");
}

function textToMatrix(text: string): Matrix {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .split(/\t| {2,}|,/)
        .map((cell) => cell.trim())
        .filter(Boolean),
    )
    .filter((row) => row.length);
}

function normalizeCell(cell: string | number | Date | undefined) {
  if (cell instanceof Date) {
    return cell.toISOString().slice(0, 10);
  }

  return String(cell ?? "").trim();
}

function extractAccount(fileName: string, lines: string[]): Account {
  const joined = lines.slice(0, 25).join(" ");
  const bankName =
    knownBanks.find((bank) => joined.toLowerCase().includes(bank.toLowerCase())) ??
    inferBankFromFile(fileName) ??
    "Unknown Bank";
  const accountNumber =
    joined.match(/account\s*(?:no|number|#)?\s*[:.-]?\s*([xX*\d]{4,20})/)?.[1] ??
    fileName.match(/statement[_ -]?(\d{3,6})/i)?.[1] ??
    fileName.match(/_(\d{3,6})_/)?.[1] ??
    "unknown";
  const holderName =
    joined.match(/(?:name|customer)\s*[:.-]\s*([A-Z][A-Z\s.]{2,40})/)?.[1]?.trim() ?? undefined;

  return {
    id: hashString(`${bankName}-${accountNumber}`),
    accountNumber,
    bankName,
    holderName,
    currency: "INR",
    balance: 0,
    lastImportedAt: new Date().toISOString(),
  };
}

function inferBankFromFile(fileName: string) {
  const normalized = fileName.toLowerCase();
  return knownBanks.find((bank) => normalized.includes(bank.toLowerCase().split(" ")[0]));
}

function parseTransactionRows(matrix: Matrix, account: Account, importId: string): Transaction[] {
  const headerIndex = matrix.findIndex((row) => isLikelyHeader(row));
  if (headerIndex >= 0) {
    return parseTableRows(matrix, headerIndex, account, importId);
  }

  return parseLooseRows(matrix, account, importId);
}

function isLikelyHeader(row: string[]) {
  const normalized = row.map((cell) => cell.toLowerCase());
  const hasDate = normalized.some((cell) => dateHeaders.some((header) => cell.includes(header)));
  const hasDescription = normalized.some((cell) =>
    descriptionHeaders.some((header) => cell.includes(header)),
  );
  const hasAmount = normalized.some((cell) =>
    [...debitHeaders, ...creditHeaders, "amount"].some((header) => cell.includes(header)),
  );

  return hasDate && hasDescription && hasAmount;
}

function parseTableRows(
  matrix: Matrix,
  headerIndex: number,
  account: Account,
  importId: string,
): Transaction[] {
  const headers = matrix[headerIndex].map((header) => header.toLowerCase());
  const dateIndex = findHeaderIndex(headers, dateHeaders);
  const descriptionIndex = findHeaderIndex(headers, descriptionHeaders);
  const debitIndex = findHeaderIndex(headers, debitHeaders);
  const creditIndex = findHeaderIndex(headers, creditHeaders);
  const balanceIndex = findHeaderIndex(headers, balanceHeaders);
  const referenceIndex = findHeaderIndex(headers, referenceHeaders);
  const amountIndex = headers.findIndex((header) => header.includes("amount"));

  return matrix
    .slice(headerIndex + 1)
    .map((row) => {
      const date = toIsoDate(row[dateIndex]);
      const description = row[descriptionIndex]?.trim();
      if (!date || !description) {
        return undefined;
      }

      const debit = debitIndex >= 0 ? Math.abs(parseMoney(row[debitIndex])) : 0;
      const credit = creditIndex >= 0 ? Math.abs(parseMoney(row[creditIndex])) : 0;
      const singleAmount = amountIndex >= 0 ? parseMoney(row[amountIndex]) : 0;
      const resolvedDebit = debit || (singleAmount < 0 ? Math.abs(singleAmount) : 0);
      const resolvedCredit = credit || (singleAmount > 0 ? singleAmount : 0);
      const balance = balanceIndex >= 0 ? parseMoney(row[balanceIndex]) : undefined;

      if (!resolvedDebit && !resolvedCredit) {
        return undefined;
      }

      return buildTransaction({
        account,
        importId,
        date,
        description,
        debit: resolvedDebit,
        credit: resolvedCredit,
        balance,
        reference: referenceIndex >= 0 ? row[referenceIndex] : undefined,
        raw: row,
      });
    })
    .filter((transaction): transaction is Transaction => Boolean(transaction));
}

function findHeaderIndex(headers: string[], options: string[]) {
  return headers.findIndex((header) => options.some((option) => header.includes(option)));
}

function parseLooseRows(matrix: Matrix, account: Account, importId: string): Transaction[] {
  return matrix
    .map((row) => {
      const line = row.join(" ");
      const date = toIsoDate(line.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/)?.[0]);
      const moneyValues = [...line.matchAll(/(?:₹\s*)?-?[\d,]+\.\d{2}/g)].map((match) =>
        parseMoney(match[0]),
      );

      if (!date || moneyValues.length < 1) {
        return undefined;
      }

      const description = line
        .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, "")
        .replace(/(?:₹\s*)?-?[\d,]+\.\d{2}/g, "")
        .trim();
      const amount = moneyValues[0];
      const balance = moneyValues.at(-1);
      const isCredit = /\b(cr|credit|deposit)\b/i.test(line) && !/\b(dr|debit|withdrawal)\b/i.test(line);

      return buildTransaction({
        account,
        importId,
        date,
        description,
        debit: isCredit ? 0 : Math.abs(amount),
        credit: isCredit ? Math.abs(amount) : 0,
        balance,
        raw: row,
      });
    })
    .filter((transaction): transaction is Transaction => Boolean(transaction));
}

function buildTransaction(input: {
  account: Account;
  importId: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance?: number;
  reference?: string;
  raw: string[];
}): Transaction {
  const amount = input.credit - input.debit;
  const id = hashString(
    fingerprint([
      input.account.id,
      input.date,
      input.description,
      input.debit.toFixed(2),
      input.credit.toFixed(2),
      input.balance?.toFixed(2),
    ]),
  );

  return {
    id,
    accountId: input.account.id,
    accountNumber: input.account.accountNumber,
    bankName: input.account.bankName,
    date: input.date,
    description: input.description,
    debit: input.debit,
    credit: input.credit,
    amount,
    balance: input.balance,
    reference: input.reference,
    category: "Uncategorized",
    categorySource: "unknown",
    categoryConfidence: 0,
    importId: input.importId,
    raw: input.raw,
  };
}
